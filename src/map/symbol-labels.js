// The palette's names for the choices of src/map/symbols.js, in the page's
// language. Every name is an explicit read of the text group, so
// test/lang.test.mjs sees each key.

/** @param {Record<string, string>} text */
export function symbolLabels(text) {
  return {
    identities: {
      friend: text.symbolFriend,
      hostile: text.symbolHostile,
      neutral: text.symbolNeutral,
      unknown: text.symbolUnknown,
      pending: text.symbolPending,
      assumed: text.symbolAssumed,
      suspect: text.symbolSuspect,
      joker: text.symbolJoker,
      faker: text.symbolFaker,
    },
    contexts: { 0: text.symbolReality, 1: text.symbolExercise, 2: text.symbolSimulation },
    statuses: {
      present: text.symbolPresent,
      planned: text.symbolPlanned,
      fullyCapable: text.symbolFullyCapable,
      damaged: text.symbolDamaged,
      destroyed: text.symbolDestroyed,
      fullToCapacity: text.symbolFullToCapacity,
    },
    echelons: {
      team: text.symbolTeam,
      squad: text.symbolSquad,
      section: text.symbolSection,
      platoon: text.symbolPlatoon,
      company: text.symbolCompany,
      battalion: text.symbolBattalion,
      regiment: text.symbolRegiment,
      brigade: text.symbolBrigade,
      division: text.symbolDivision,
      corps: text.symbolCorps,
      army: text.symbolArmy,
      armyGroup: text.symbolArmyGroup,
      region: text.symbolRegion,
      command: text.symbolCommand,
    },
    mobilities: {
      wheeledLimited: text.symbolWheeledLimited,
      wheeled: text.symbolWheeled,
      tracked: text.symbolTracked,
      combined: text.symbolCombined,
      towed: text.symbolTowed,
      rail: text.symbolRail,
      snow: text.symbolSnow,
      sled: text.symbolSled,
      pack: text.symbolPack,
      barge: text.symbolBarge,
      amphibious: text.symbolAmphibious,
    },
    fields: {
      uniqueDesignation: text.symbolUniqueDesignation,
      higherFormation: text.symbolHigherFormation,
      additionalInformation: text.symbolAdditionalInformation,
      staffComments: text.symbolStaffComments,
      quantity: text.symbolQuantity,
      reinforcedReduced: text.symbolReinforcedReduced,
      dtg: text.symbolDtg,
      type: text.symbolType,
      combatEffectiveness: text.symbolCombatEffectiveness,
      speed: text.symbolSpeed,
      altitudeDepth: text.symbolAltitudeDepth,
      direction: text.symbolDirection,
    },
    sizes: { small: text.symbolSmall, medium: text.symbolMedium, large: text.symbolLarge },
  };
}
