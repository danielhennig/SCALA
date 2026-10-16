"use client";

import { useState } from "react";
import { ApiActionButton } from "@/components/api-action-button";
import { Button } from "@/components/ui/button";
import { formatDuration, shiftWindowLabel } from "@/domain/scheduling/time";
import { ShiftTypeForm, type ShiftTypeValues } from "./shift-type-form";

export function ShiftTypeRow({
  orgId,
  shiftType,
  canManage,
}: {
  orgId: string;
  shiftType: Required<ShiftTypeValues>;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="p-3">
        <ShiftTypeForm
          orgId={orgId}
          initial={shiftType}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: shiftType.color }}
        />
        <div className="min-w-0">
          <div className="truncate font-medium">{shiftType.name}</div>
          <div className="text-sm text-muted-foreground">
            {shiftWindowLabel(shiftType.startTime, shiftType.durationMinutes)} ·{" "}
            {formatDuration(shiftType.durationMinutes)}
          </div>
        </div>
      </div>
      {canManage && (
        <div className="flex items-start gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <ApiActionButton
            path={`/api/v1/orgs/${orgId}/shift-types/${shiftType.id}`}
            confirmMessage={`Excluir o tipo de turno ${shiftType.name}?`}
            variant="destructive"
          >
            Excluir
          </ApiActionButton>
        </div>
      )}
    </li>
  );
}
