import { shiftWindowLabel } from "@/domain/scheduling/time";

type StripShift = {
  name: string;
  color: string;
  startTime: string;
  durationMinutes: number;
};

/**
 * A rotation cycle as a row of day boxes: colored by shift type, empty for a
 * day off. No hooks, so it renders on the server and inside client editors.
 */
export function CycleStrip({ days }: { days: (StripShift | null)[] }) {
  return (
    <ol className="flex flex-wrap gap-1" aria-label="Ciclo do regime">
      {days.map((shift, index) => {
        const label = shift
          ? `Dia ${index + 1}: ${shift.name}, ${shiftWindowLabel(shift.startTime, shift.durationMinutes)}`
          : `Dia ${index + 1}: folga`;
        return (
          <li
            key={index}
            title={label}
            aria-label={label}
            className="flex size-8 items-center justify-center rounded-md border text-xs"
            style={
              shift
                ? {
                    backgroundColor: shift.color,
                    borderColor: shift.color,
                    color: "#fff",
                  }
                : undefined
            }
          >
            <span aria-hidden="true">{shift ? shift.name[0] : "–"}</span>
          </li>
        );
      })}
    </ol>
  );
}
