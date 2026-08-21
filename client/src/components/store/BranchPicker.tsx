import { MapPin, Phone } from 'lucide-react';
import { formatBranchLocation } from '../../utils/format';
import type { Branch } from '../../types/api';

interface BranchPickerProps {
  branches: Branch[];
  /** Selected branch id, or `''` for "no preference". */
  value: string;
  onChange: (branchId: string) => void;
  /** Radio group name — must be unique on the page. */
  name?: string;
  /** Adds a "No preference" card so the customer can skip choosing. */
  allowNone?: boolean;
  noneLabel?: string;
}

/**
 * Branch chooser shared by checkout, trade-in and installment.
 *
 * This is purely a convenience — the catalog and stock are global, so picking a
 * branch never changes prices or availability. It records where the customer
 * would rather transact. Renders nothing when there are no branches to offer
 * (e.g. the branch list failed to load), so a form is never blocked by it.
 */
export function BranchPicker({
  branches,
  value,
  onChange,
  name = 'branchId',
  allowNone = true,
  noneLabel = 'No preference',
}: BranchPickerProps) {
  if (branches.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {branches.map((branch) => {
        const active = value === branch.id;
        const location = formatBranchLocation(branch);
        return (
          <label
            key={branch.id}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
              active ? 'border-brand-400 bg-white/70' : 'border-white/60 bg-white/40 hover:bg-white/60'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={branch.id}
              checked={active}
              onChange={() => onChange(branch.id)}
              className="sr-only"
            />
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                active ? 'brand-gradient text-white' : 'bg-white/70 text-ink-soft'
              }`}
            >
              <MapPin size={18} />
            </span>
            <span className="flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">{branch.name}</span>
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                    active ? 'border-brand-500' : 'border-ink-soft/40'
                  }`}
                >
                  {active && <span className="h-2.5 w-2.5 rounded-full brand-gradient" />}
                </span>
              </span>
              {location && <span className="mt-0.5 block text-xs text-ink-soft">{location}</span>}
              {branch.phone && (
                <span className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
                  <Phone size={11} /> {branch.phone}
                </span>
              )}
            </span>
          </label>
        );
      })}

      {allowNone && (
        <label
          className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors sm:col-span-2 ${
            value === '' ? 'border-brand-400 bg-white/70' : 'border-white/60 bg-white/40 hover:bg-white/60'
          }`}
        >
          <input
            type="radio"
            name={name}
            value=""
            checked={value === ''}
            onChange={() => onChange('')}
            className="sr-only"
          />
          <span
            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
              value === '' ? 'border-brand-500' : 'border-ink-soft/40'
            }`}
          >
            {value === '' && <span className="h-2.5 w-2.5 rounded-full brand-gradient" />}
          </span>
          <span className="text-sm font-semibold text-ink">{noneLabel}</span>
        </label>
      )}
    </div>
  );
}
