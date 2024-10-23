import fs from "node:fs";
import ships from "./sde-json/ships_with_dogma.json";
// import ships from "./test-ships.json";

const shieldResist4percentEffectIds = new Set([1816, 1817, 1819, 1820]);
const damageTypes = ["em", "thermal", "kinetic", "explosive"] as const;
const damageAmounts = {
  em: 25,
  thermal: 25,
  kinetic: 25,
  explosive: 25,
} as const;

const totalDamage =
  damageAmounts.em +
  damageAmounts.thermal +
  damageAmounts.kinetic +
  damageAmounts.explosive;

const hardenerAmountsForRigSize = {
  1: 1200, // MSE
  2: 2750, // LSE
  3: 2750, // LSE
  4: 79200, // Cap Shield Ext
};

const pithAMultispecHardner = 0.422;

// These assume Shield Mindlink
const commandBurstGroupBonuses = {
  // Combat battlecruisers - 1 link
  419: {
    shieldExtension: 1.188, // 18.8%
    shieldHarmonizing: 0.0,
  },
  // Command ship
  540: {
    shieldExtension: 1.225, // 22.5%
    shieldHarmonizing: 0.225,
  },
  // Command destroyer
  1534: {
    shieldExtension: 1.206, // 20.6%
    shieldHarmonizing: 0.0, //
  },
};

function peakShieldRechargeRate(
  shieldHp: number,
  shieldRechargeTime: number
): number {
  // https://wiki.eveuniversity.org/Tanking#Passive_shield_tanking
  const C_max = shieldHp;
  const C = C_max / 4; // peak is at 25%
  const T = shieldRechargeTime;
  return ((10 * C_max) / T) * (Math.sqrt(C / C_max) - C / C_max) * 1000;
}

function calcSackingPenalty(n: number) {
  return Math.pow(Math.E, -1 * Math.pow(n / 2.67, 2));
}

function shipStats(ship: any) {
  let hardners = 0;
  let extenders = 0;

  const medSlots = ship.dogma.dogmaAttributes.medSlots;
  if (medSlots > 0 && medSlots <= 2) {
    hardners = 1;
    extenders = 1;
  } else if (medSlots === 3) {
    hardners = 1;
    extenders = 2;
  } else if (medSlots === 4 || medSlots === 5) {
    hardners = 2;
    extenders = medSlots - 2;
  } else {
    hardners = 3;
    extenders = medSlots - 3;
  }

  /**
   * Shield HP
   */
  let rawShieldHp: number = ship.dogma.dogmaAttributes.shieldCapacity;

  // BattleshipRoleBonusArmorPlate&ShieldExtenderHP 100% LSE increase
  if (ship.dogma.dogmaEffects.find((dogma) => dogma.effectID === 8377)) {
    rawShieldHp +=
      hardenerAmountsForRigSize[ship.dogma.dogmaAttributes.rigSize] *
      extenders *
      2;
  } else {
    rawShieldHp +=
      hardenerAmountsForRigSize[ship.dogma.dogmaAttributes.rigSize] * extenders;
  }

  rawShieldHp *= 1.25; // Shield Management V
  rawShieldHp *= 1.5363; // 53.63% HG Nirvanas
  rawShieldHp *= 1.06; // Shield management SM-706 6%

  if (commandBurstGroupBonuses[ship.groupID]) {
    rawShieldHp *= commandBurstGroupBonuses[ship.groupID].shieldExtension;
  }

  let shieldRechargeTime: number =
    ship.dogma.dogmaAttributes.shieldRechargeRate;

  shieldRechargeTime *= 0.75; // Shield Operation V - 5% reduction per level
  shieldRechargeTime *= 1 - 0.06; // Shield operation SP-906 6%;

  for (let i = 0; i < ship.dogma.dogmaAttributes.lowSlots; i++) {
    shieldRechargeTime *= 1 - 0.26; // Caldari Navy Shield power relay: 26%
  }
  for (let i = 0; i < ship.dogma.dogmaAttributes.rigSlots; i++) {
    shieldRechargeTime *= 1 - 0.25; // Field Purger rigs: 25%
  }

  const peakRecharge = peakShieldRechargeRate(rawShieldHp, shieldRechargeTime);

  /**
   * Resists
   */

  // The resists applied to every damage type
  // It starts at 1 and reduces now, 0 would be 100% resist
  let flatResistIncrease = 1;

  // Does the ship have a shield resist bonus?
  for (let i = 0; i < ship.dogma.dogmaEffects.length; i++) {
    // If a ship has the 4% resist per level, apply it as 20% for level V and break
    if (
      shieldResist4percentEffectIds.has(ship.dogma.dogmaEffects[i].effectID)
    ) {
      flatResistIncrease = 1 - 0.2;
      break;
    }
    // Edencom Resist of 30%
    if (ship.dogma.dogmaEffects[i].effectID === 8047) {
      flatResistIncrease = 1 - 0.3;
      break;
    }
  }

  const resists = {
    em: ship.dogma.dogmaAttributes.shieldEmDamageResonance * flatResistIncrease,
    thermal:
      ship.dogma.dogmaAttributes.shieldThermalDamageResonance *
      flatResistIncrease,
    kinetic:
      ship.dogma.dogmaAttributes.shieldKineticDamageResonance *
      flatResistIncrease,
    explosive:
      ship.dogma.dogmaAttributes.shieldExplosiveDamageResonance *
      flatResistIncrease,
  };

  for (let i = 0; i < hardners; i++) {
    const stackingPenalty = calcSackingPenalty(i);
    const appliedResist = pithAMultispecHardner * stackingPenalty;

    // flatResistIncrease * (1 - appliedResist);
    for (let damageType of damageTypes) {
      resists[damageType] *= 1 - appliedResist;
    }
  }

  // Command burst
  if (commandBurstGroupBonuses[ship.groupID]) {
    for (let damageType of damageTypes) {
      resists[damageType] *=
        1 - commandBurstGroupBonuses[ship.groupID].shieldHarmonizing;
    }
  }

  // em resist = 0.8, which is 20%
  // copied from PyFa code, but still different values
  let specificDivisor = 0;

  for (let damageType of damageTypes) {
    const resonance = resists[damageType];
    const damage = damageAmounts[damageType];
    specificDivisor += (damage / (totalDamage * 1.0)) * resonance;
  }

  const effectiveHp = rawShieldHp / specificDivisor;
  const effectiveHpPerSec = peakShieldRechargeRate(
    effectiveHp,
    shieldRechargeTime
  );

  return {
    ship: ship.name,
    extenders,
    hardners,
    hasCommandBurst: commandBurstGroupBonuses[ship.groupID] ? "yes" : "no",
    rawShieldHp: Math.floor(rawShieldHp).toLocaleString(),
    // peakRecharge: peakRecharge.toFixed(2),
    // shieldRechargeTime: (shieldRechargeTime / 1000).toFixed(),
    // lowSlots: ship.dogma.dogmaAttributes.lowSlots,
    // resists: {
    //   emResist: Math.round((1 - resists.em) * 100).toFixed(1),
    //   thermalResist: Math.round((1 - resists.thermal) * 100).toFixed(1),
    //   kineticResist: Math.round((1 - resists.kinetic) * 100).toFixed(1),
    //   explosiveResist: Math.round((1 - resists.explosive) * 100).toFixed(1),
    // },
    // rawResists: resists,
    effectiveShieldHp: effectiveHp,
    effectiveHpPerSec: effectiveHpPerSec,
  };
}

const rigToShipStats = {
  0: [],
  1: [],
  2: [],
  3: [],
  4: [],
};

for (const ship of ships) {
  const stats = shipStats(ship);

  rigToShipStats[ship.dogma.dogmaAttributes.rigSize ?? 0].push(stats);
}

Object.keys(rigToShipStats).forEach((key) => {
  rigToShipStats[key].sort((a, b) => b.effectiveHpPerSec - a.effectiveHpPerSec);

  fs.writeFileSync(
    `./output/rig-size-${key}.json`,
    JSON.stringify(rigToShipStats[key], null, "\t")
  );
});
