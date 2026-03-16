'use client';

import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

export default function ApiDocs({ spec }: { spec: object }) {
  return (
    <div style={{ padding: '20px', background: 'white', minHeight: '100vh' }}>
      <SwaggerUI spec={spec} />
    </div>
  );
}