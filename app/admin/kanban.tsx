import React from 'react';
import { DevKanbanScreen } from '../../src/components/dev/DevKanbanScreen';

// Route stack (accès direct / tap notification) → flèche retour visible.
export default function AdminKanbanRoute() {
  return <DevKanbanScreen showBack />;
}
