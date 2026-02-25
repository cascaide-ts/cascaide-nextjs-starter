import { serverWorkflowConfig } from '@/graphs/server/config'
import { createWorkflowHandler} from '@cascaide-ts/server-next'


export const POST =  createWorkflowHandler(serverWorkflowConfig);