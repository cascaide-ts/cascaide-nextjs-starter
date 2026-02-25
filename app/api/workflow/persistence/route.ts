import { createPersistenceHandler } from '@cascaide-ts/server-next';
import { PostgresPersistor } from '@/lib/persistor';
import { sql } from '@/lib/connection';
import { NextRequest } from 'next/server';

const persistor = new PostgresPersistor(sql);
console.log("........about to call")
// export const POST = createPersistenceHandler(persistor);

// api/workflow/persistence/route.ts

export const POST = async (req: NextRequest) => {
    try {
      const handler = createPersistenceHandler(persistor);
      return await handler(req);
    } catch (error: any) {
      // THIS WILL LOG THE ACTUAL POSTGRES ERROR TO YOUR TERMINAL
      console.error("❌ PERSISTENCE CRASH:", error.message, error.detail);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  };