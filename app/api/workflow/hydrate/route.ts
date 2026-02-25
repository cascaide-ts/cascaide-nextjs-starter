import { createHydrationHandler } from '@cascaide-ts/server-next';
import {PostgresPersistor} from '@cascaide-ts/postgres-js'
import { sql } from '@/lib/connection';


const persistor = new PostgresPersistor(sql);

export const POST = createHydrationHandler(persistor);