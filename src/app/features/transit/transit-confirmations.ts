import { ConfirmDialogData } from '../../shared/ui/confirm-dialog';
import { RECORD_STATUS, RecordStatus } from './transit.models';

/**
 * Consequence copy for lifecycle changes. Only server behaviour verified in Agent A's transit service
 * is stated: commuter lists show Active routes that have at least one Active direction.
 */
export function statusChangeConfirmation(
  kind: 'route' | 'direction',
  name: string,
  from: RecordStatus,
  to: RecordStatus,
): ConfirmDialogData {
  const label = RECORD_STATUS[to].label;
  const leavingActive = from === 'ACTIVE' && to !== 'ACTIVE';
  const message =
    to === 'ACTIVE'
      ? kind === 'route'
        ? `${name} will become visible to commuters once it has at least one Active direction.`
        : `${name} will become visible to commuters if its route is also Active.`
      : leavingActive
        ? `${name} will no longer appear in commuter route lists.`
        : `${name} will be marked ${label}. It is not visible to commuters.`;
  return {
    title: `Change ${kind} status to ${label}?`,
    message,
    confirmLabel: `Mark ${label}`,
    destructive: leavingActive || to === 'ARCHIVED',
  };
}
