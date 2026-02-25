import { tavily } from "@tavily/core";
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


const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

export const executeTool = async (toolCall: ToolCall): Promise<ToolResult> => {
    const { name, arguments: argsString } = toolCall.function;
   
    try {
        const args = JSON.parse(argsString);
        let toolResultData: any;

        switch (name) {
            case 'display_chart':
                if (!args.type || !args.data || !args.title) {
                    throw new Error('Chart requires type, data, and title');
                }
                toolResultData = { success: true, message: 'Chart configuration accepted' };
                break;

            case 'search_tool':
                // Using the direct Tavily search method
                // .search() returns a clean object containing results, images, etc.
                const response = await tvly.search(args.query, {
                    searchDepth: "basic", // or "advanced"
                    maxResults: 5,
                    topic: "general"
                });
                
                // We typically only need the 'results' array for the LLM context
                toolResultData = response.results;
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
        return {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
                error: error.message || 'Tool execution failed'
            })
        };
    }
};