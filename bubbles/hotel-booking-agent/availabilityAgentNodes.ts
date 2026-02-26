
import { WorkflowContext } from '@cascaide-ts/core';
import { executeTool, ToolCall, ToolResult } from './availabilityTools';



export async function availabilityAgentNodePrep(context: WorkflowContext, initialContext: any) {
  const cascadeId = initialContext.cascadeId;
  const dataArray = context[cascadeId]

  const history = dataArray.flatMap(item => item.history || []);
  return { history };
}
export async function availabilityAgentNodeExec(prepOutput: any) {
  'use server';

  const { history} = prepOutput;
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


const available_hotels = {
  type: 'function' as const,
  function: {
    name: 'available_hotels',
    description: 'Fetches a JSON List of hotels,rooms their prices nad other additional details',
    parameters: {
      type: 'object',
      properties: {},     
      required: [],
    },
  },
};

  try {
  
    const systemPrompt =`

### ROLE
You are the hotel retrieval Agent. Your sole purpose is to provide accurate information about available hotels and their prices.

### GOALS
1. When you receive a query, ALWAYS call the 'available_hotels' tool first to get the latest data.
2. Filter the results based on the user's specific request (e.g., if they ask for a specific suite or a price constraint).
3. If the user's request is general (e.g., "What is available?"), summarize the top options from the available data.
4. Always use return the image_urls of the hotels fetched along with the data

### RESPONSE GUIDELINES
- Be concise. 
- If a user asks for a hotel that doesn't exist in the data, politely inform them of the available hotels.
- Format your output so the Supervisor Agent can easily present it to the end user.

    `
    .trim();
    


  

    const conversationHistory = [
      { role: 'system' as const, content: systemPrompt },
      ...history,
    ];

    const stream = await openai.chat.completions.create({
      model: 'gpt-4.1-mini-2025-04-14',
      stream: true,
      messages: conversationHistory as any,
      tools: [available_hotels],
      tool_choice: 'auto',
      temperature: 1,
    });

    return { stream, provider: 'openai',isReasoning: false};
  } catch (error: any) {
    throw new Error(`Agent execution failed: ${error.message}`);
  }
}



export async function availabilityAgentNodePost(execOutput: any) {
  const { assistantMessage, cascadeId } = execOutput;

  
  const pendingToolCalls = assistantMessage.tool_calls || [];
  const shouldSpawnNode = pendingToolCalls.length > 0 ;
  const updates = {
    [cascadeId]: {
      history: assistantMessage,
      status: pendingToolCalls.length > 0 ? 'calling_tool' : 'complete',
    },
  };

  // Construct the spawns Record if necessary
  const spawns: Record<string, any> = {};
  
  if (shouldSpawnNode) {
    spawns['availabilityToolNode'] = {
      history: assistantMessage,
      toolCallsToExecute: pendingToolCalls,
    };
  }

  return {
    updates,
    spawns: Object.keys(spawns).length > 0 ? spawns : undefined,
  };
}




export async function availabilityToolNodePrep(selectedData: any, initialContext: any) {
  const toolCallsToExecute = initialContext.toolCallsToExecute || [];

  if (toolCallsToExecute.length === 0) {

    if (!initialContext.hasOwnProperty('toolCallsToExecute')) {
         throw new Error('toolNodePrep Error: No specific toolCallsToExecute array was provided in the context.');
    }
  }

  // If the property exists but the array is empty, we proceed (Exec will see 0 tools)
  return { toolCallsToExecute, cascadeId: initialContext.cascadeId};
}

// /path/to/your/nodes.ts (toolNodeExec)

export async function availabilityToolNodeExec(prepOutput: any) {
  'use server';
  const { toolCallsToExecute, cascadeId} = prepOutput; 
  const { executeTool } = await import('./availabilityTools');

  const results = await Promise.all(
    toolCallsToExecute.map(async (toolCall: ToolCall) => {
      try {
        const toolResult = await executeTool(toolCall);
        return { toolCall, toolResult };
      } catch (err: any) {
        return {
          toolCall,
          toolResult: {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: err.message || 'Tool execution failed' }),
          },
        };
      }
    })
  );

  return { results, cascadeId};
}

export async function availabilityToolNodePost(execOutput: any) {
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
      'availabilityAgentNode': { 
        history: toolResultsOnly, 
      },
    },
  };
}
