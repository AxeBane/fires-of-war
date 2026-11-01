/** Rulebook Supports: an ally grants the Primary stat of its Affinity, and the Secondary from B Rank,
 * while both units are deployed on the same map. Only the highest-ranked deployed Support counts. */
export const AFFINITY_STATS = Object.freeze({
    Fire: ["strength", "speed"], Thunder: ["skill", "magic"], Wind: ["speed", "luck"], Ice: ["resistance", "defense"],
    Earth: ["defense", "build"], Dark: ["magic", "luck"], Light: ["luck", "charm"], Anima: ["magic", "charm"]
});
/** [Primary, Secondary] bonus at each Support Rank. */
export const SUPPORT_RANK_BONUS = Object.freeze({C: [1, 0], B: [2, 1], A: [3, 1], S: [4, 2]});
const RANK_ORDER = {C: 1, B: 2, A: 3, S: 4};
const STAT_LABELS = {strength: "STR", magic: "MAG", skill: "SKL", speed: "SPD", defense: "DEF", resistance: "RES", luck: "LUK", charm: "CHA", build: "BLD"};
const nameKey = name => String(name ?? "").trim().toLowerCase();

/** Stat bonuses a partner of `affinity` grants at `rank`, e.g. {strength: 4, speed: 2}. */
export function supportBonuses(affinity, rank) {
    const stats = AFFINITY_STATS[affinity], amounts = SUPPORT_RANK_BONUS[rank];
    if (!stats || !amounts) return {};
    const bonuses = {};
    stats.forEach((stat, index) => { if (amounts[index]) bonuses[stat] = (bonuses[stat] ?? 0) + amounts[index]; });
    return bonuses;
}

export const supportBonusText = bonuses => Object.entries(bonuses).map(([stat, value]) => `+${value} ${STAT_LABELS[stat] ?? stat}`).join(", ") || "—";

/** A token actor's own map; otherwise the viewed (or active) map, if the unit has a token there. */
function deployedScene(actor) {
    if (actor.isToken) return actor.token?.parent ?? null;
    const scene = globalThis.canvas?.scene ?? globalThis.game?.scenes?.active;
    return Array.from(scene?.tokens ?? []).some(token => token.actorId === actor.id) ? scene : null;
}

/** A partner is on the map when a token there is named after it, or belongs to an Actor of that name. */
function partnerDeployed(scene, actor, name) {
    const key = nameKey(name);
    return !!key && Array.from(scene?.tokens ?? []).some(token => token.actorId !== actor.id
        && (nameKey(token.name) === key || nameKey(globalThis.game?.actors?.get(token.actorId)?.name) === key));
}

/** Each Support with its bonuses and whether its partner is on this unit's map; `active` is the one that applies. */
export function supportStatus(actor) {
    const scene = deployedScene(actor);
    const supports = Object.entries(actor?.system?.supportRanks ?? {}).map(([key, support]) => {
        const bonuses = supportBonuses(support.affinity, support.rank);
        return {key, name: support.name, affinity: support.affinity, rank: support.rank, bonuses, bonusText: supportBonusText(bonuses),
            order: RANK_ORDER[support.rank] ?? 0, deployed: !!scene && partnerDeployed(scene, actor, support.name)};
    });
    const deployed = supports.filter(support => support.deployed && support.order && Object.keys(support.bonuses).length);
    const best = Math.max(0, ...deployed.map(support => support.order));
    const tied = deployed.filter(support => support.order === best);
    // Equal ranks: the unit chooses which Support to use for the map.
    const active = tied.find(support => support.key === actor.system.activeSupport) ?? tied[0] ?? null;
    return {supports, active, tied: tied.length > 1 ? tied.map(support => support.key) : []};
}

const hasSupports = actor => actor?.type === "character" && Object.keys(actor.system?.supportRanks ?? {}).length > 0;

/** Re-prepare units with Supports after deployments change, so their stats and open sheets follow. */
export function refreshSupports(scene = globalThis.canvas?.scene) {
    const actors = new Set(Array.from(globalThis.game?.actors ?? []).filter(hasSupports));
    for (const token of scene?.tokens ?? []) if (hasSupports(token.actor)) actors.add(token.actor);
    for (const actor of actors) {
        actor.reset();
        if (actor.sheet?.rendered) actor.sheet.render(false);
    }
}

export function registerSupports() {
    const sceneOf = document => document?.parent?.documentName === "Scene" ? document.parent : undefined;
    Hooks.on("canvasReady", () => refreshSupports());
    for (const hook of ["createToken", "deleteToken"]) Hooks.on(hook, token => refreshSupports(sceneOf(token)));
    Hooks.on("updateToken", (token, change) => { if ("name" in change || "actorId" in change) refreshSupports(sceneOf(token)); });
    Hooks.on("updateActor", (actor, change) => { if ("name" in change) refreshSupports(); });
    Hooks.on("deleteActor", () => refreshSupports());
}
