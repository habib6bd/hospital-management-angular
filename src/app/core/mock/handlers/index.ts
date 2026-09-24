import type { MockHandler } from '../mock-types';
import { authHandler } from './auth.handler';
import { patientsHandler } from './patients.handler';
import { appointmentsHandler } from './appointments.handler';
import { inventoryHandler } from './inventory.handler';
import { labHandler } from './lab.handler';
import { billingHandler } from './billing.handler';

/**
 * Handler chain. The dispatcher tries each in order and uses the first that
 * does not return `null`. New feature domains append their handler here.
 */
export const MOCK_HANDLERS: readonly MockHandler[] = [
  authHandler,
  patientsHandler,
  appointmentsHandler,
  inventoryHandler,
  labHandler,
  billingHandler,
];
