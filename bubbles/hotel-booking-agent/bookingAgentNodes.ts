import { executeTool, ToolCall, ToolResult } from './supervisorTools'; // 👈 MODIFIED IMPORT
import { WorkflowContext } from '@cascaide-ts/core';

type Message = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[]; 
  tool_call_id?: string;
  name?: string;
};



const systemPrompt = `
### ROLE
You are the Payment Processor Agent. Your job is to finalize bookings by generating payment links for hotels.

### GOALS
1. Extract the 'hotel' and 'room type' from the Supervisor's query string.
2. Call the 'processBookingPayment' tool with these details.
3. Provide the user with the Booking ID .

### RULES
- NEVER simulate a successful booking without calling the tool.
- Always proceed to book the hotel after you recieve the hotel name and room type

### RESPONSE FORMAT
- "I've reserved your room at [hotel name]."



 `.trim();


const processBookingPayment = {
  type: 'function' as const,
  function: {
    name: 'processBookingPayment',
    description: `Generates a payment link for hotel booking.`,
    parameters: {
      type: 'object' as const,
      properties: {
        "hotelName": {
            "type": "string",
            "description": "The name of the hotel to be booked."
          },
          "roomType": {
            "type": "string",
            "description": "the room type that needs to be booked."
          }
        },
        "required": ["hotelName", "roomType"]
    },
  },
};


export async function bookingAgentNodePrep(context: WorkflowContext, initialContext: any) {
  const cascadeId = initialContext.cascadeId;
  const dataArray = context[cascadeId]

  const history = dataArray.flatMap(item => item.history || []);

  return { history, cascadeId};
}

// This is the ONLY function that needs 'use server' since it calls OpenAI
export async function bookingAgentNodeExec(prepOutput: any) {
  'use server';

  const { history, cascadeId } = prepOutput;


  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {

    const conversationHistory = [
      { role: 'system' as const, content: systemPrompt },
      ...history,
    ];

    const stream = await openai.chat.completions.create({
      model: 'gpt-4.1-mini-2025-04-14',
      stream: true,
      messages: conversationHistory as any,
      tools: [
        processBookingPayment // 👈 THE ONLY TOOL
      ],
      tool_choice: 'auto',
      temperature: 0.7,
    });

    const assistantMessage: Message = { role: 'assistant', content: '', tool_calls: [] };

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        assistantMessage.content = (assistantMessage.content || '') + delta.content;
      }

      if (delta.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          const index = toolCall.index;
          if (!assistantMessage.tool_calls![index]) {
            assistantMessage.tool_calls![index] = { id: '', type: 'function', function: { name: '', arguments: '' } };
          }
          if (toolCall.id) assistantMessage.tool_calls![index].id = toolCall.id;
          if (toolCall.function?.name) assistantMessage.tool_calls![index].function.name = toolCall.function.name;
          if (toolCall.function?.arguments) assistantMessage.tool_calls![index].function.arguments += toolCall.function.arguments;
        }
      }
    }

    if (!assistantMessage.content) assistantMessage.content = null;
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) delete assistantMessage.tool_calls;

    return { assistantMessage, cascadeId};
  } catch (error: any) {
    throw new Error(`Agent execution failed: ${error.message}`);
  }
}

// /path/to/your/nodes.ts (analyticsAgentNodePost)

export async function bookingAgentNodePost(execOutput: any) {
  const { assistantMessage, cascadeId} = execOutput;
  
  const toolCallsToExecute = assistantMessage.tool_calls || [];

  const shouldSpawnNode = toolCallsToExecute.length > 0 ;
  const updates = {
    [cascadeId]: {
      history: assistantMessage,
      status: toolCallsToExecute.length > 0 ? 'calling_tool' : 'complete',

    },
  };

  // Construct the spawns Record if necessary
  const spawns: Record<string, any> = {};
  
  if (shouldSpawnNode) {
    spawns['bookingUiNode'] = {
      history: assistantMessage,
      toolCallsToExecute: toolCallsToExecute,
    };
  }

  return {
    updates,
    spawns: Object.keys(spawns).length > 0 ? spawns : undefined,
  };
}


// export function bookingToolNodePrep(context: WorkflowContext, initialContext: any) {
 
//   const cascadeId = initialContext.cascadeId;
  
//   const toolCallsToExecute = initialContext.toolCallsToExecute || [];

//   if (toolCallsToExecute.length === 0) {
//     // If the property is missing entirely, it's a workflow error.
//     if (!initialContext.hasOwnProperty('toolCallsToExecute')) {
//          throw new Error('toolNodePrep Error: No specific toolCallsToExecute array was provided in the context.');
//     }
//   }

//   return { toolCallsToExecute, cascadeId };
// }


// export async function bookingToolNodeExec(prepOutput: any) {
//   'use server';
//   const { toolCallsToExecute, cascadeId } = prepOutput; 
//   const { executeTool } = await import('./supervisorTools'); 

//   const results = await Promise.all(
//     toolCallsToExecute.map(async (toolCall: ToolCall) => {
//       try {
//         const toolResult = await executeTool(toolCall);
//         return { toolCall, toolResult };
//       } catch (err: any) {
//         return {
//           toolCall,
//           toolResult: {
//             role: 'tool',
//             tool_call_id: toolCall.id,
//             content: JSON.stringify({ error: err.message || 'Tool execution failed' }),
//           },
//         };
//       }
//     })
//   );

//   return { results, cascadeId };
// }


// export async function bookingToolNodePost(execOutput: any) {
//   const { results, cascadeId } = execOutput;

//   const toolResultsOnly = results.map((r: any) => r.toolResult);


//   return {
//     updates: {
//       [cascadeId]: {
//         history: toolResultsOnly,
//         status: 'complete',
//       },
//     },
//     spawns: {
//       'bookingAgentNode': { 
//         history: toolResultsOnly, 
//       },
//     },
//   };

// }
