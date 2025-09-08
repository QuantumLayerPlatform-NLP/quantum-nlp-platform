import { useState } from 'react';

interface User {
  id: string;
  name: string;
  organizationId: string;
}

export const useAuth = () => {
  const [user] = useState<User | null>({
    id: 'demo-user',
    name: 'Demo User', 
    organizationId: 'demo-org'
  });
  const [loading] = useState(false);

  return {
    user,
    loading
  };
};