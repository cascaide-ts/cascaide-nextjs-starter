import { WorkflowHandlerConfig } from '@cascaide-ts/core';
import {PostgresPersistor} from '@cascaide-ts/postgres-js';
import { sql } from '@/lib/connection';
import { serverWorkflowGraph } from './graph';


// 1. Instantiate the logic provider
const workflowpersistor = new PostgresPersistor(sql);

const MAX_EXECUTION_TIME = 100000; 
const SAFE_BUFFER = 6000; 

export const serverWorkflowConfig:WorkflowHandlerConfig={
  workflowGraph:serverWorkflowGraph,
  persistor: workflowpersistor, // The user passes their PostgresPersistor here
  maxExecutionTime: MAX_EXECUTION_TIME,
  safeBuffer: SAFE_BUFFER
}