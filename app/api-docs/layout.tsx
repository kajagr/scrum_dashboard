import { getApiDocs } from '@/lib/swagger';
import ApiDocsClient from './page';

export default function ApiDocsPage() {
  const spec = getApiDocs();
  return <ApiDocsClient spec={spec} />;
}