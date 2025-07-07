import fs from "node:fs";
import ships from "./sde-json/ships_with_dogma.json";
// import ships from "./test-ships.json";

/*
Bump equations taken from here
https://docs.google.com/document/d/1rwVWjTvzVdPEFETf0vwm649AFb4bgRBaNLpRPaoB03o
*/

// These assume Skirmish Mindlink
const commandBurstGroupBonuses = {
  // Combat battlecruisers - 1 link
  419: {
    rapidDeployment: 1.208, // 20.8%
  },
  // Command ship
  540: {
    rapidDeployment: 1.338, // 33.8%
  },
  // Command destroyer
  1534: {
    rapidDeployment: 1.309, // 30.9%
  },
} as const;

const rigSizeToMWD = {
  0: {
    // Compact 5mn
    speedIncrease: 5.05,
    thrust: 1_500_000,
    pwg: 14,
    massAddition: 500_000,
  },
  1: {
    // Compact 50mn
    speedIncrease: 5.05,
    thrust: 15_000_000,
    pwg: 135,
    massAddition: 5_000_000,
  },
  2: {
    // Compact 500mn
    speedIncrease: 5.05,
    thrust: 150_000_000,
    pwg: 1125,
    massAddition: 50_000_000,
  },
  3: {
    // Core X 500mn
    speedIncrease: 5.20,
    thrust: 150_000_000,
    pwg: 1250,
    massAddition: 50_000_000,
  },
  4: {
    // Dommination 50000mn
    speedIncrease: 5.12,
    thrust: 1_500_000_000,
    pwg: 80_000,
    massAddition: 500_000_000,
  },
} as const;

function calcSackingPenalty(n: number) {
  return Math.pow(Math.E, -1 * Math.pow(n / 2.67, 2));
}

function bumpDistance(v1: number, m1: number, m2: number, inertiaModifier: number) {
  return ((2 * v1 * m1) / (m1 + m2)) * (m2 * inertiaModifier);
}

function shipStats(ship: (typeof ships)[0]) {

  let baseSpeed = ship.dogma.dogmaAttributes.maxVelocity;
  baseSpeed *= 1.25; // Nav V
  baseSpeed *= 1.2473; // HG Snakes
  baseSpeed *= 1.05; // Zor Hyper Link


  const rigSize = ship.dogma.dogmaAttributes.rigSize ?? 0;

  const mwd = rigSizeToMWD[rigSize]
  let mwdIncrease = mwd.speedIncrease;
  mwdIncrease *= 1.25; // Acceleration Control V

  // Command Burst applies to the MWD
  if (commandBurstGroupBonuses[ship.groupID]) {
    mwdIncrease *= commandBurstGroupBonuses[ship.groupID].rapidDeployment;
  }

  const mwdSpeed = baseSpeed * (1 + mwdIncrease * (mwd.thrust / (ship.mass + mwd.massAddition)));

  const m1 = (ship.mass + mwd.massAddition) / 1_000_000;

  const tornadoBump = bumpDistance(mwdSpeed, m1, 15_200_000 / 1_000_000, 0.321);
  const orcaBump = bumpDistance(mwdSpeed, m1, 130_200_000 / 1_000_000, 0.0862);

  return {
    ship: ship.name,
    hasCommandBurst: commandBurstGroupBonuses[ship.groupID] ? "yes" : "no",
    mwdSpeed: Math.floor(mwdSpeed),
    tornadoBumpDistance: Math.floor(tornadoBump),
    orcaBumpDistance: Math.floor(orcaBump),
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

  if (ships.length < 10) {
    console.log(stats);
  }

  rigToShipStats[ship.dogma.dogmaAttributes.rigSize ?? 0].push(stats);
}

Object.keys(rigToShipStats).forEach((key) => {
  rigToShipStats[key].sort((a, b) => b.tornadoBump - a.tornadoBump);

  fs.writeFileSync(
    `./output/bump-tornado/rig-size-${key}.json`,
    JSON.stringify(rigToShipStats[key], null, "\t")
  );
});

Object.keys(rigToShipStats).forEach((key) => {
  rigToShipStats[key].sort((a, b) => b.orcaBump - a.orcaBump);

  fs.writeFileSync(
    `./output/bump-orca/rig-size-${key}.json`,
    JSON.stringify(rigToShipStats[key], null, "\t")
  );
});
