'use client';
import { useState} from 'react';


import { useWorkflow } from '@cascaide-ts/react';

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}



type ToolCall = {
    function: {
        name: string;
        arguments: string;
    }
}



export default function BookingUi( { nodeId }: { nodeId: string }) {

const {addActiveNode, signalCompletion, nodeData} = useWorkflow(nodeId);
const cascadeId = nodeData.initialContext.cascadeId;


  const [pin, setPin] = useState('');

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    const toolResponse = {
          "role":"tool",
          "tool_call_id": nodeData.initialContext.history.tool_calls[0].id,
          "content": "Booking confirmed, booking id is : azzdfgr146"
        }


    await addActiveNode('bookingAgentNode', {
      cascadeId: cascadeId,
      history: [toolResponse], 
      userId: "guest-id"
    });


    signalCompletion({nodeId,hasSpawns:true});

  };

    


  return (
  /* Backdrop Container: Fixed to the full viewport, z-index ensures it stays on top */
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
    
    
    <div className="w-full max-w-sm p-8 bg-white rounded-2xl shadow-2xl transform transition-all scale-100">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
        Enter PIN
      </h2>
        
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••••"
            className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            required
            autoFocus // Automatically focus for better UX
          />
        </div>
        
        <button
          type="submit"
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200"
        >
          Submit
        </button>
      </form> 
      
      <p className="mt-4 text-xs text-center text-gray-500">
        Please enter your security code to continue.
      </p>
    </div>
  </div>
);
}