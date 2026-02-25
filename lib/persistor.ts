import postgres, { Sql } from 'postgres';
import { randomUUID } from 'crypto';
import {
  CascadePersistence,
} from '@cascaide-ts/core';

import { ClaimRequest, ClaimResponse, WorkflowContext } from '@cascaide-ts/core';

export class PostgresPersistor implements CascadePersistence {
  constructor(private sql: postgres.Sql<{}>) {}

  async claimNodeExecution(params: ClaimRequest): Promise<ClaimResponse> {
    const startTime = performance.now();
    const {
      nodeInstanceId,
      cascadeId,
      userId,
      nodeName,
      functionId: requestedId,
      inputContext,
      location,
    } = params;

    console.log('Claiming node execution:', { cascadeId, nodeName, requestedId });

    // Generate UUID in application instead of database for better performance
    const executionId = randomUUID();

    const result = await this.sql.begin(async (sql: any) => {
      const result = await sql`
        WITH conflict_check AS (
          -- Single aggregation combining conflict detection and MAX calculation
          -- More efficient than separate EXISTS and MAX queries
          SELECT 
            CASE 
              WHEN COUNT(*) FILTER (WHERE function_id = ${requestedId}) > 0 
              THEN MAX(function_id) + 1
              ELSE ${requestedId}
            END as next_fn_id
          FROM node_executions 
          WHERE cascade_id = ${cascadeId}
        ),
        cascade_upsert AS (
          INSERT INTO cascades (id, user_id, status, fn_id, created_at, updated_at)
          SELECT ${cascadeId}, ${userId}, 'RUNNING', next_fn_id, NOW(), NOW()
          FROM conflict_check
          ON CONFLICT (id) DO UPDATE 
            SET fn_id = EXCLUDED.fn_id, updated_at = NOW()
          RETURNING fn_id
        )
        INSERT INTO node_executions (
          id, 
          node_instance_id, 
          cascade_id, 
          node_name, 
          function_id, 
          input_context, 
          location, 
          status, 
          started_at
        )
        SELECT 
          ${executionId}, 
          ${nodeInstanceId}, 
          ${cascadeId}, 
          ${nodeName}, 
          fn_id, 
          ${this.sql.json(inputContext)}, 
          ${location}, 
          'RUNNING', 
          NOW()
        FROM cascade_upsert
        RETURNING status, function_id as "functionId"
      `;

      return {
        status: result[0].status,
        functionId: Number(result[0].functionId),
      };
    });

    const latency = performance.now() - startTime;
    console.log(`claimNodeExecution latency: ${latency.toFixed(2)}ms`, { cascadeId, nodeName });

    return result;
  }

  async finalizeNodeExecution(params: {
    nodeInstanceId: string;
    cascadeId: string;
    fullOutput: any;
    hasSpawns: boolean;
  }): Promise<{ status: string }> {
    const startTime = performance.now();
    const { nodeInstanceId, cascadeId, fullOutput, hasSpawns } = params;

    const result = await this.sql.begin(async (sql: any) => {
      // Combine both UPDATEs into a single query using CTE for better performance
      await sql`
        WITH updated_node AS (
          UPDATE node_executions
          SET 
            status = 'COMPLETED',
            full_output = ${this.sql.json(fullOutput)},
            completed_at = NOW()
          WHERE node_instance_id = ${nodeInstanceId}
          RETURNING cascade_id
        )
        UPDATE cascades
        SET status = 'COMPLETED', updated_at = NOW()
        WHERE id IN (SELECT cascade_id FROM updated_node)
          AND ${!hasSpawns}
      `;

      return { status: 'COMPLETED' };
    });

    const latency = performance.now() - startTime;
    console.log(`finalizeNodeExecution latency: ${latency.toFixed(2)}ms`, { cascadeId, nodeInstanceId });

    return result;
  }

  async markExecutionFailed(
    nodeInstanceId: string,
    cascadeId: string,
    error: string
  ): Promise<{ status: string }> {
    const startTime = performance.now();

    const result = await this.sql.begin(async (sql: any) => {
      // CRITICAL FIX: Use sql parameter instead of this.sql to maintain transaction semantics
      // Combine both UPDATEs into single query for better performance
      await sql`
        WITH updated_node AS (
          UPDATE node_executions
          SET status = 'FAILED', error = ${error}, completed_at = NOW()
          WHERE node_instance_id = ${nodeInstanceId}
          RETURNING cascade_id
        )
        UPDATE cascades
        SET status = 'ERROR', updated_at = NOW()
        WHERE id IN (SELECT cascade_id FROM updated_node)
      `;

      return { status: 'FAILED' };
    });

    const latency = performance.now() - startTime;
    console.log(`markExecutionFailed latency: ${latency.toFixed(2)}ms`, { cascadeId, nodeInstanceId });

    return result;
  }

  async recordContextEvents(params: {
    cascadeId: string;
    functionId: number;
    updates: { [key: string]: any };
  }): Promise<{ status: string }> {
    const startTime = performance.now();
    const { cascadeId, functionId, updates } = params;

    const events = Object.entries(updates).map(([key, value]) => ({
      key,
      value: this.sql.json(value),
      function_id: functionId,
      cascade_id: cascadeId,
      created_at: new Date(),
    })); 

    if (events.length === 0) {
      const latency = performance.now() - startTime;
      console.log(`recordContextEvents latency: ${latency.toFixed(2)}ms (no events)`, { cascadeId, functionId });
      return { status: 'SUCCESS' };
    }

    await this.sql`
      INSERT INTO context_events ${this.sql(events, 'key', 'value', 'function_id', 'cascade_id', 'created_at')}
    `;

    const latency = performance.now() - startTime;
    console.log(`recordContextEvents latency: ${latency.toFixed(2)}ms (${events.length} events)`, { cascadeId, functionId });

    return { status: 'SUCCESS' };
  }

  async hydrateCascadeContext(
    cascadeId: string,
    upToFunctionId: number
  ): Promise<WorkflowContext> {
    const startTime = performance.now();

    const events = await this.sql`
      SELECT key, value, function_id, created_at
      FROM context_events
      WHERE cascade_id = ${cascadeId}
        AND function_id < ${upToFunctionId}
      ORDER BY function_id ASC, created_at ASC
    `;

    // Optimized in-memory reconstruction using Map for faster lookups
    const context: WorkflowContext = {};

    for (const event of events) {
      const key = event.key;
      const value = event.value;

      if (!context[key]) {
        context[key] = [];
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value) && 'index' in value) {
        const index = value.index as number;
        context[key][index] = value;
      } else {
        context[key].push(value);
      }
    }

    const latency = performance.now() - startTime;
    console.log(`hydrateCascadeContext latency: ${latency.toFixed(2)}ms (${events.length} events)`, { cascadeId, upToFunctionId });

    return context;
  }

  async forkCascade(params: {
    sourceCascadeId: string;
    newCascadeId: string;
    upToFunctionId: number;
  }): Promise<{ newCascadeId: string; status: string }> {
    const startTime = performance.now();
    const { sourceCascadeId, newCascadeId, upToFunctionId } = params;
  
    await this.sql.begin(async (sql: any) => {
      // 1. Fork the cascade row from source, resetting fn_id to the fork point
      await sql`
        INSERT INTO cascades (id, user_id, status, fn_id, created_at, updated_at)
        SELECT
          ${newCascadeId},
          user_id,
          'RUNNING',
          ${upToFunctionId - 1},
          NOW(),
          NOW()
        FROM cascades
        WHERE id = ${sourceCascadeId}
      `;
  
      // 2. Copy node_executions up to (not including) upToFunctionId
      await sql`
        INSERT INTO node_executions (
          id,
          node_instance_id,
          cascade_id,
          node_name,
          function_id,
          input_context,
          location,
          status,
          started_at,
          completed_at,
          full_output,
          error
        )
        SELECT
          gen_random_uuid(),
          node_instance_id,
          ${newCascadeId},
          node_name,
          function_id,
          input_context,
          location,
          status,
          started_at,
          completed_at,
          full_output,
          error
        FROM node_executions
        WHERE cascade_id = ${sourceCascadeId}
          AND function_id < ${upToFunctionId}
      `;
  
      // 3. Copy context_events up to (not including) upToFunctionId
      await sql`
        INSERT INTO context_events (
          key,
          value,
          function_id,
          cascade_id,
          created_at
        )
        SELECT
          key,
          value,
          function_id,
          ${newCascadeId},
          created_at
        FROM context_events
        WHERE cascade_id = ${sourceCascadeId}
          AND function_id < ${upToFunctionId}
      `;
    });
  
    const latency = performance.now() - startTime;
    console.log(`forkCascade latency: ${latency.toFixed(2)}ms`, { sourceCascadeId, newCascadeId, upToFunctionId });
  
    return { newCascadeId, status: 'SUCCESS' };
  }
}