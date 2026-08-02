import { getGuestOptionQty } from '../../domain/defaults';

/**
 * Red lights for step 2:
 * - Required + empty → always on (click alone does NOT clear)
 * - Required + has value → on until clicked/touched, then off
 * - Optional → on until clicked/touched, then off (even if still empty/0/unchecked)
 */
export function buildStep2FieldLights({
  roomsData,
  trainingTypes = [],
  countOptions = [],
  touched = {},
}) {
  const lights = {};
  const on = (key) => {
    lights[key] = true;
  };
  const wasTouched = (key) => !!touched[key];

  /** Required: empty stays lit; filled lights until user clicks. */
  const requiredLit = (key, hasValue) => {
    if (!hasValue) on(key);
    else if (!wasTouched(key)) on(key);
  };

  /** Optional: click/touch clears even without a “filled” value. */
  const optionalLit = (key) => {
    if (!wasTouched(key)) on(key);
  };

  (roomsData || []).forEach((room, ri) => {
    requiredLit(`room:${ri}:roomType`, !!room.roomType);
    requiredLit(
      `room:${ri}:guestCount`,
      Number(room.guestCount || room.guests?.length || 0) > 0,
    );

    (room.guests || []).forEach((g, gi) => {
      const gk = (field) => `guest:${ri}:${gi}:${field}`;

      requiredLit(gk('name'), !!String(g.name || '').trim());
      requiredLit(gk('nationality'), !!String(g.nationality || '').trim());
      requiredLit(gk('level'), !!g.level);
      requiredLit(gk('discipline'), !!g.discipline);
      requiredLit(
        gk('targetDepth'),
        !(g.targetDepth === '' || g.targetDepth == null),
      );
      requiredLit(gk('startDate'), !!g.startDate);
      requiredLit(gk('endDate'), !!g.endDate);

      // Times always display a fallback — treat as having a value; click clears
      requiredLit(gk('checkInTime'), true);
      requiredLit(gk('checkOutTime'), true);

      optionalLit(gk('dawnCheckIn'));
      optionalLit(gk('lateCheckOut'));

      const activeTraining = (trainingTypes || []).filter(
        (tr) => tr.isActive !== false,
      );
      let totalTrain = 0;
      for (const tr of activeTraining) {
        const key = gk(`train:${tr.id}`);
        const qty = Number(g.trainingCounts?.[tr.id]) || 0;
        totalTrain += qty;
        // Each qty row is optional; click clears. Group rule is separate.
        optionalLit(key);
      }

      let funQty = 0;
      for (const opt of countOptions || []) {
        const key = gk(`opt:${opt.id}`);
        const qty = getGuestOptionQty(g, opt.id);
        if (opt.id === 'FUN_DIVING' || opt.guideKey === 'fundiving') {
          funQty += qty;
        }
        optionalLit(key);
      }

      // At least one training / fun diving is required
      requiredLit(gk('training'), totalTrain > 0 || funQty > 0);

      const selfCount = Number(g.trainingCounts?.SELF_60) || 0;
      if (selfCount > 0) {
        requiredLit(
          gk('safetyInstructor'),
          !!String(g.safetyInstructor || '').trim(),
        );
        requiredLit(gk('agreeSelf60'), !!g.agreeSelf60);
      }

      optionalLit(gk('airportPickup'));
      if (g.airportPickup) {
        requiredLit(
          gk('pickupFlight'),
          !!String(g.pickupFlight || '').trim(),
        );
        requiredLit(gk('pickupTime'), true);
      }

      optionalLit(gk('airportDropoff'));
      if (g.airportDropoff) {
        requiredLit(
          gk('dropoffFlight'),
          !!String(g.dropoffFlight || '').trim(),
        );
        requiredLit(gk('dropoffTime'), true);
      }
    });
  });

  return lights;
}
