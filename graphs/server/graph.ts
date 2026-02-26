
import { searchAgentNodeExec, searchAgentNodePrep, searchAgentNodePost, searchToolNodePrep, searchToolNodeExec, searchToolNodePost} from '@/bubbles/search-agent/searchAgentNodes';
import { supervisorAgentNodeExec, supervisorAgentNodePost, supervisorAgentNodePrep, supervisorToolNodeExec, supervisorToolNodePost, supervisorToolNodePrep} from '@/bubbles/hotel-booking-agent/supervisorAgentNodes';
import {
  bookingAgentNodePrep,
  bookingAgentNodeExec,
  bookingAgentNodePost,
} from '@/bubbles/hotel-booking-agent/bookingAgentNodes';
import { availabilityAgentNodeExec, availabilityAgentNodePost, availabilityAgentNodePrep, availabilityToolNodeExec, availabilityToolNodePost, availabilityToolNodePrep} from '@/bubbles/hotel-booking-agent/availabilityAgentNodes';

import { ServerWorkflowGraph } from '@cascaide-ts/core'



export const serverWorkflowGraph: ServerWorkflowGraph = {

    supervisorAgentNode: {
      name: 'supervisorAgentNode',
      prep: supervisorAgentNodePrep ,
      exec: supervisorAgentNodeExec,
      post: supervisorAgentNodePost,
      isStreaming: false,
      isUINode:false,
      env:'server'
    },
    supervisorToolNode: {
      name: 'supervisorToolNode',
      prep: supervisorToolNodePrep,
      exec: supervisorToolNodeExec,
      post: supervisorToolNodePost,
      isUINode:false,
      isStreaming:false,
      env:'server'
    },


    bookingAgentNode: {
      name: 'bookingAgentNode',
      prep: bookingAgentNodePrep ,
      exec: bookingAgentNodeExec,
      post: bookingAgentNodePost,
      isUINode:false,
      isStreaming:false,
      env:'server',
    },
 

    availabilityAgentNode: {
      name: 'availabilityAgentNode',
      prep: availabilityAgentNodePrep,
      exec: availabilityAgentNodeExec,
      post: availabilityAgentNodePost,
      isStreaming:true,
      env:'server',
      isUINode:false
    },
    availabilityToolNode: {
      name: 'availabilityToolNode',
      prep: availabilityToolNodePrep,
      exec: availabilityToolNodeExec,
      post: availabilityToolNodePost,
      isStreaming:false,
      env:'server',
      isUINode:false
    },

    searchAgentNode: {
      name: 'searchAgentNode',
      prep:  searchAgentNodePrep,
      exec: searchAgentNodeExec,
      post: searchAgentNodePost,
      isStreaming: true,
      isUINode:false,
      env:'server'
    },
    searchToolNode: {
      name: 'searchToolNode',
      prep: searchToolNodePrep,
      exec: searchToolNodeExec,
      post: searchToolNodePost,
      isUINode:false,
      isStreaming:false,
      env:'server'
    },

    
  };
  