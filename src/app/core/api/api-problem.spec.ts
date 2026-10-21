import { HttpErrorResponse } from '@angular/common/http';

import { toApiProblem } from './api-problem';

describe('toApiProblem', () => {
  it('reads the Agent A error envelope', () => {
    const err = new HttpErrorResponse({
      status: 409,
      error: { error: { code: 'CONFLICT', message: 'Already exists', requestId: 'req-9' } },
    });
    expect(toApiProblem(err)).toEqual({
      status: 409,
      code: 'CONFLICT',
      message: 'Already exists',
      requestId: 'req-9',
      details: undefined,
    });
  });

  it('describes network failures', () => {
    expect(toApiProblem(new HttpErrorResponse({ status: 0 })).code).toBe('NETWORK_ERROR');
  });

  it('falls back for unstructured bodies', () => {
    const problem = toApiProblem(new HttpErrorResponse({ status: 502, error: '<html>' }));
    expect(problem).toMatchObject({ status: 502, code: 'HTTP_502' });
    expect(problem.requestId).toBeUndefined();
  });
});
