

// Note: ToolCall and ToolResult types remain the same as defined in your original code.
export type ToolCall = {
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string; // JSON string
    };
  };
  
export type ToolResult = {
    role: 'tool';
    tool_call_id: string;
    content: string; // JSON stringified result or error
};

// 🚀 NEW: Define the Message type required for the history argument
export type Message = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  // Simplified for this file, assuming presence of tool_calls/tool_call_id
  tool_calls?: any[]; 
  tool_call_id?: string;
  name?: string;
};



// ============================================================================
// TOOL EXECUTION HANDLER
// ============================================================================

/**
 * Executes the appropriate tool based on the ToolCall object.
 * NOTE: This function is now focused on the standard tools (BigQuery/Chart).
 * The 'create_report' logic is handled upstream in toolNodeExec.
 */
export const executeTool = async (toolCall: ToolCall): Promise<ToolResult> => {
    const { name, arguments: argsString } = toolCall.function;
    
   
    try {
        const args = JSON.parse(argsString);
        let toolResultData: any;

        switch (name) {
            
            
            case 'display_chart':
                // The display_chart tool is client-side only (no DB interaction)
                // It just validates the structure before the post-processing step
                if (!args.type || !args.data || !args.title) {
                    throw new Error('Chart requires type, data, and title');
                }
                toolResultData = { success: true, message: 'Chart configuration accepted' };
                break;

            case 'create_report':

              toolResultData = { success: true, message: 'Chart configuration accepted' };
              break;
            default:
                throw new Error(`Unknown tool: ${name}`);
    }

        return {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResultData)
        };

    } catch (error: any) {
        // Catch parsing errors (e.g., bad JSON in argsString) or other synchronous errors
        return {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
                error: error.message || 'Tool execution failed'
            })
        };
    }
};