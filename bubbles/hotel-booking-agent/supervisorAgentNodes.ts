import { WorkflowContext } from '@cascaide-ts/core';
import { executeTool, ToolCall, ToolResult } from './supervisorTools';

type Message = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

export async function supervisorAgentNodePrep(context: WorkflowContext, initialContext: any) {
  const cascadeId = initialContext.cascadeId;
  const dataArray = context[cascadeId] || [];
  const history = dataArray.flatMap((item: any) => item.history || []);

  return { history, cascadeId };
}

export async function supervisorAgentNodeExec(prepOutput: any) {
  'use server';

  const { history, cascadeId } = prepOutput;

  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const delegate_to_availabilityAgent = {
    type: 'function' as const,
    function: {
      name: 'delegate_to_availabilityAgent',
      description: 'Delegates availability-related tasks. Use this for checking slots, finding open turfs, or answering questions about slot timings of the turfs.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The natural language instruction for the sub-agent. Example: "Check if Apex Arena has slots open after 6 PM today."'
          }
        },
        required: ['query'],
      },
    },
  };

  const delegate_to_bookingAgent = {
    type: 'function' as const,
    function: {
      name: 'delegate_to_bookingAgent',
      description: 'Delegates payment and booking finalization. Use this when the user is ready to pay for a specific turf and slot.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The natural language instruction for the payment agent. Example: "Process payment for Downtown Turf for the 7 PM - 8 PM slot."'
          }
        },
        required: ['query'],
      },
    },
  };

  const present_hotel_options = {
    type: 'function' as const,
    function: {
      name: 'present_hotel_options',
      description: 'Presents a list of hotels with their main image, description, and available room types with pricing.',
      parameters: {
        type: 'object',
        properties: {
          hotels: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                hotel_name: { type: 'string' },
                hotel_image_url: { type: 'string' },
                description: { type: 'string' },
                available_rooms: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      room_type: { type: 'string' },
                      price: { type: 'number' }
                    },
                    required: ['room_type', 'price']
                  }
                }
              },
              required: ['hotel_name', 'hotel_image_url', 'description', 'available_rooms']
            }
          }
        },
        required: ['hotels'],
      },
    },
  };

  try {
    const systemPrompt = `
### ROLE
You are a Hotel Booking Supervisor. Your job is to act as the central brain, routing user requests to the correct sub-agent and maintaining the state of the booking process.

### SUB-AGENTS
1. Availability_Checker: Use this when the user asks about open times, specific turf schedules, or general availability.
2. Payment_Processor: Use this after 'present_hotel_options' tool gives you the date and, hotel and room type to book

### OPERATIONAL RULES
- If the user intent is vague, call Availability_Checker.
- If details are missing for booking, prompt the user.
- Use present_hotel_options to display the available hotels.

**CRITICAL**: Always use present_hotel_options tool to present results.
`.trim();

    const conversationHistory = [
      { role: 'system' as const, content: systemPrompt },
      ...history,
    ];

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fixed model name
      stream: false,
      messages: conversationHistory,
      tools: [delegate_to_availabilityAgent, delegate_to_bookingAgent, present_hotel_options],
      tool_choice: 'auto',
      temperature: 0.7,
    });

    return { assistantMessage: stream.choices[0].message, cascadeId };

  } catch (error: any) {
    throw new Error(`Agent execution failed: ${error.message}`);
  }
}

export async function supervisorAgentNodePost(execOutput: any) {
  const { assistantMessage, cascadeId } = execOutput;

  const allToolCalls: ToolCall[] = assistantMessage.tool_calls || [];

  // Filter: Keep ONLY the tools that ARE NOT delegation or presentation tools
  const pendingToolCalls = allToolCalls.filter(tc => {
    const isDelegationOrDisplay = tc.function.name.startsWith('delegate_to_') || 
                                  tc.function.name === 'present_hotel_options';
    
    return !isDelegationOrDisplay;
  });

  const shouldSpawnNode = pendingToolCalls.length > 0;
  
  const updates = {
    [cascadeId]: {
      history: assistantMessage,
      status: shouldSpawnNode ? 'calling_tool' : 'complete',
    },
  };

  const spawns: Record<string, any> = {};
  if (shouldSpawnNode) {
    spawns['supervisorToolNode'] = {
      history: assistantMessage,
      toolCallsToExecute: pendingToolCalls,
      cascadeId
    };
  }

  return {
    updates,
    spawns: Object.keys(spawns).length > 0 ? spawns : undefined,
  };
}
export async function supervisorToolNodePrep(context: WorkflowContext, initialContext: any) {
  const cascadeId = initialContext.cascadeId;
  const toolCallsToExecute = initialContext.toolCallsToExecute || [];

  if (toolCallsToExecute.length === 0) {
    throw new Error('toolNodePrep Error: No specific toolCallsToExecute array was provided.');
  }
  return { toolCallsToExecute, cascadeId };
}

export async function supervisorToolNodeExec(prepOutput: any) {
  'use server';

  const { toolCallsToExecute, cascadeId } = prepOutput;
  // Ensure we are importing the actual tool execution logic
  const { executeTool } = await import('./supervisorTools');

  const results = await Promise.all(
    toolCallsToExecute.map(async (toolCall: ToolCall) => {
      const functionName = toolCall.function.name;
      const toolCallId = toolCall.id;

      try {
        const toolResult = await executeTool(toolCall);
        return { toolCall, toolResult };
      } catch (err: any) {
        return {
          toolCall,
          toolResult: {
            role: 'tool',
            tool_call_id: toolCallId,
            content: JSON.stringify({ error: `Tool execution failed for ${functionName}: ${err.message}` }),
          },
        };
      }
    })
  );

  return { results, cascadeId };
}

export async function supervisorToolNodePost(execOutput: any) {
  const { results, cascadeId } = execOutput;
  const toolResultsOnly = results.map((r: any) => r.toolResult);

  return {
    updates: {
      [cascadeId]: {
        history: toolResultsOnly,
        status: 'complete',
      },
    },
    spawns: {
      'supervisorAgentNode': {
        history: toolResultsOnly,
      },
    },
  };
}