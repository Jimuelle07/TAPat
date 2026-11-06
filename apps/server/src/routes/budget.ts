// POST /api/program/budget-checkout (docs/api-and-data.md §5.2 #4): a Velo checkout session for the LGU's budget deposit.
import type { FastifyInstance } from 'fastify';
import { budgetCheckoutBodySchema } from '@tapat/shared';
import { createBudgetCheckout, type BudgetDeps } from '../services/budget';

export function registerBudgetRoutes(app: FastifyInstance, deps: BudgetDeps): void {
  app.post('/api/program/budget-checkout', async (request, reply) => {
    const body = budgetCheckoutBodySchema.parse(request.body);
    return reply.code(201).send(await createBudgetCheckout(deps, body));
  });
}
