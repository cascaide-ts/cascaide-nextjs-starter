

import { WorkflowContext, SpawnContext, StreamConfig, Spawns, Updates } from '@cascaide-ts/core';
import { executeTool, ToolCall } from './searchAgentTools';




export async function searchAgentNodePrep(context: WorkflowContext, initialContext: any) {
  const cascadeId = initialContext.cascadeId;
  const dataArray = context[cascadeId]
  const history = dataArray.flatMap(item => item.history || []);
  console.log(JSON.stringify(history))
  console.log(cascadeId)



  return { 
    history: history
  };
}

export async function searchAgentNodeExec(prepOutput: any) {
  'use server';

  const { history} = prepOutput;
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


  const search_tool={
    type: 'function' as const,
    function: {
      name: 'search_tool',
      description: 'searches the web using the input query.',
      parameters: {
        type: 'object',
        properties: { 
          query: { 
            type: 'string', 
            description: 'The natural language query' 
          } 
        },
        required: ['query'],
      },
    },
  }
  

  try {
    

    const systemPrompt = `

You are an expert technical AI assistant equipped with web search capabilities and a Model Context Protocol (MCP) connection. You are strictly a technical and development-focused agent; do not adopt a marketing or business analyst persona. Your primary job is to investigate technical queries, discover available MCP tools, and execute them precisely.

You have access to three primary tools. You must use them according to the following strict guidelines:

1. search_tool

Use Case: Use this for general web searches, finding current documentation, or retrieving facts from the internet.

Action: Pass a clear, concise query.

2. mcp_discovery

Use Case: You MUST run this tool before attempting to execute any MCP-specific task if you do not already know the exact tool names and required schemas currently available on the server.

Action: Call this tool (it requires no arguments) to receive a list of available tools, their descriptions, and most importantly, their required_schema.

3. mcp_executor

Use Case: Use this to run the tools you found using mcp_discovery.

CRITICAL INSTRUCTION FOR EXECUTION: When calling this tool, you are strictly required to provide BOTH tool_name and tool_args.

Formatting tool_args: * You must never leave tool_args undefined or null.

tool_args MUST be a valid JSON object matching the required_schema from the discovery step.

If the tool requires no arguments, you must explicitly pass an empty object: {}.

Example of correct usage: {"tool_name": "example_tool", "tool_args": {"target_url": "https://example.com", "limit": 5}}

Standard Operating Procedure:

Understand Request: Determine if the user's request requires general web search or specialized MCP execution.

Discover (If needed): If the task requires MCP tools, run mcp_discovery to map your available actions and their required parameters.

Analyze Schema: Carefully read the required_schema of the target tool. Pay close attention to which fields are required versus optional.

Execute: Call mcp_executor. Double-check that your tool_args object perfectly matches the schema you just read.

Respond: Present the raw data, code, or results clearly to the user without unnecessary conversational filler.




`.trim();

    const conversationHistory = [
      { role: 'system' as const, content: systemPrompt },
      ...history,
    ];
   console.log(JSON.stringify(history));
    const stream = await openai.chat.completions.create({
      model: 'gpt-4.1-mini-2025-04-14',
      stream: true,
      messages: conversationHistory as any,
      tools: [search_tool],
      tool_choice: 'auto',
      temperature: 0.7,
    });

    return {stream, provider:'openai', isReasoning: false} as StreamConfig

  } catch (error: any) {
    throw new Error(`Agent execution failed: ${error.message}`);
  }
}


export async function searchAgentNodePost(execOutput: any) {
  const { assistantMessage, cascadeId} = execOutput;

  const pendingToolCalls = assistantMessage.tool_calls || [];
  const shouldSpawnNode = pendingToolCalls.length > 0 

  const updates = {
    [cascadeId]: {
      history: assistantMessage,
      status: pendingToolCalls.length > 0 ? 'calling_tool' : 'complete',
      chartConfig: null,
      lastUpdate: Date.now(),
    },
  } as Updates;

  // Construct the spawns Record if necessary
  const spawns: Spawns = {};
  
  if (shouldSpawnNode) {
    spawns['searchToolNode'] = {
      history: assistantMessage,
      toolCallsToExecute: pendingToolCalls,
    } 
  }

  return {
    updates,
    spawns: Object.keys(spawns).length > 0 ? spawns : undefined,
  };
}



export  async function searchToolNodePrep(context: WorkflowContext, initialContext: any) {

  const toolCallsToExecute = initialContext.toolCallsToExecute || [];

  if (toolCallsToExecute.length === 0) {
    if (!initialContext.hasOwnProperty('toolCallsToExecute')) {
         throw new Error('toolNodePrep Error: No specific toolCallsToExecute array was provided in the context.');
    }
  }
  return { toolCallsToExecute, cascadeId: initialContext.cascadeId};
}




export async function searchToolNodeExec(prepOutput: any) {
  'use server';
  
  const { toolCallsToExecute, cascadeId} = prepOutput; 
 
  const results = await Promise.all(
    toolCallsToExecute.map(async (toolCall: ToolCall) => {
      
      const functionName = toolCall.function.name;
      const toolCallId = toolCall.id;
      
      try {
        let toolResult;
        toolResult = await executeTool(toolCall);
        return { toolCall, toolResult };
        
      } catch (err: any) {
        return {
          toolCall,
          toolResult: {
            role: 'tool',
            tool_call_id: toolCallId,
            content: JSON.stringify({ error: `Tool execution failed for ${functionName}: ${err.message || 'Unknown error'}` }),
          },
        };
      }
    })
  );
  return { results, cascadeId};
}


export async function searchToolNodePost(execOutput: any) {

  const { results, cascadeId } = execOutput;

  const toolResultsOnly = results.map((r: any) => r.toolResult);

  return {
    updates: {
      [cascadeId]: {
        history: toolResultsOnly,
        status: 'complete',

      },
    },
    spawns:{
      'searchAgentNode': {  
        history: toolResultsOnly, 
      },
    },
  };
}