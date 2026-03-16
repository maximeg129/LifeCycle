'use client';

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  public context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    const message = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:
{
  "operation": "${context.operation}",
  "path": "${context.path}"${context.requestResourceData ? `,
  "request": ${JSON.stringify(context.requestResourceData, null, 2)}` : ''}
}`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;

    // This ensures the error is correctly identified as a permission error by the listener
    Object.setPrototypeOf(this, FirestorePermissionError.prototype);
  }
}
