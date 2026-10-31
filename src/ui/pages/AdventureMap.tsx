import { useState } from "react";
import {
  ADVENTURE_SKILL_SLOTS,
  ADVENTURE_STAGES_PER_REGION,
  OWN_SWORD_BONUS,
  adventureRegions,
  adventureSkills,
  canChallengeStage,
  getAdventureEnemy,
  getAdventureReward,
  getClearedStages,
  getExploreMap,
  getFrontierStage,
  getStageReferenceAttack,
  isBossStage,
  isRegionOpen,
  repeatsLeftToday,
  type AdventureProgress,
  type AdventureSkillId,
} from "../../features/adventure";
import { towerThemes } from "../../features/tower";
import { weaponCatalog } from "../../features/weapon";

const zh = (value: number) => Math.round(value).toLocaleString("zh-TW");

interface AdventureMapProps {
  readonly progress: AdventureProgress;
  readonly attack: number;
  readonly weaponId: string;
  readonly unlockedWeaponIds: readonly string[];
  readonly skills: readonly AdventureSkillId[];
  readonly onSkillsChange: (skills: readonly AdventureSkillId[]) => void;
  readonly onChallenge: (regionIndex: number, stage: number) => void;
  /** Walk the region's map instead (only regions that have one). */
  readonly onExplore: (regionIndex: number) => void;
}

/**
 * The 遊歷 map: ten regions (each opens when the boss before it falls), six
 * stages each with the attack they are sized for and what they pay, and the
 * three skills to take into the fight.
 */
export function AdventureMap({ progress, attack, weaponId, unlockedWeaponIds, skills, onSkillsChange, onChallenge, onExplore }: AdventureMapProps): JSX.Element {
  const [regionIndex, setRegionIndex] = useState(() => getFrontierStage(progress).regionIndex);
  const region = adventureRegions[regionIndex];
  const theme = towerThemes.find(entry => entry.id === region.themeId) ?? towerThemes[0];
  const cleared = getClearedStages(progress, regionIndex);
  const repeatsLeft = repeatsLeftToday(progress, Date.now());

  const toggleSkill = (id: AdventureSkillId): void => {
    if (skills.includes(id)) {
      if (skills.length > 1) onSkillsChange(skills.filter(skill => skill !== id));
    } else if (skills.length < ADVENTURE_SKILL_SLOTS) {
      onSkillsChange([...skills, id]);
    }
  };

  return (
    <section className="adventure-map" aria-label="遊歷地圖">
      <nav className="adventure-map__regions" aria-label="地區">
        {adventureRegions.map(entry => {
          const open = isRegionOpen(progress, entry.index);
          const done = getClearedStages(progress, entry.index);
          return (
            <button key={entry.themeId} type="button" className={entry.index === regionIndex ? "is-current" : ""} disabled={!open} onClick={() => setRegionIndex(entry.index)}>
              <strong>{entry.nameZh}</strong>
              <small>{open ? `${done} / ${ADVENTURE_STAGES_PER_REGION}` : "未開放"}</small>
            </button>
          );
        })}
      </nav>

      <div className="adventure-map__region" style={{ backgroundImage: theme.background ? `linear-gradient(rgba(6, 16, 28, 0.55), rgba(6, 16, 28, 0.85)), url("${theme.background}")` : undefined }}>
        <header>
          <h2>{region.nameZh}</h2>
          <p>打倒第 {ADVENTURE_STAGES_PER_REGION} 關的首領開放下一區。重複挑戰今天還能領 {repeatsLeft} 次獎勵（首次通關不限）。</p>
          {getExploreMap(regionIndex) && <button type="button" className="adventure-map__explore" onClick={() => onExplore(regionIndex)}>進入探索（試玩）</button>}
        </header>
        <ol className="adventure-map__stages">
          {Array.from({ length: ADVENTURE_STAGES_PER_REGION }, (_, offset) => {
            const stage = offset + 1;
            const enemy = getAdventureEnemy(regionIndex, stage);
            const recommended = getStageReferenceAttack(regionIndex, stage);
            const available = canChallengeStage(progress, regionIndex, stage);
            const firstClear = stage > cleared;
            const reward = getAdventureReward(regionIndex, stage, firstClear, () => 0);
            const ready = attack >= recommended;
            return (
              <li key={stage} className={[isBossStage(stage) ? "is-boss" : "", stage <= cleared ? "is-cleared" : "", available ? "" : "is-locked"].filter(Boolean).join(" ")}>
                <span className="adventure-map__stage-name">第 {stage} 關・{enemy.nameZh}{isBossStage(stage) ? "（首領）" : ""}</span>
                <span className={ready ? "adventure-map__power is-ready" : "adventure-map__power"}>建議攻擊 {zh(recommended)}・你 {zh(attack)}</span>
                <span className="adventure-map__reward">
                  {firstClear ? "首次" : repeatsLeft > 0 ? "重複" : "今日已領完"}
                  {(firstClear || repeatsLeft > 0) && <>：靈石 {zh(reward.spiritStones)}・妖丹 {zh(reward.demonCores)}{firstClear && isBossStage(stage) ? "・靈丹 ×1" : ""}</>}
                </span>
                <button type="button" disabled={!available} onClick={() => onChallenge(regionIndex, stage)}>{stage <= cleared ? "再戰" : "挑戰"}</button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="adventure-map__skills">
        <h2>帶入戰鬥的招式（{skills.length} / {ADVENTURE_SKILL_SLOTS}）</h2>
        <p>每把仙劍解鎖一招。裝備那把劍時，它的招式傷害 +{Math.round(OWN_SWORD_BONUS * 100)}%。</p>
        <div className="adventure-map__skill-list">
          {adventureSkills.map(skill => {
            const unlocked = unlockedWeaponIds.includes(skill.weaponId);
            const chosen = skills.includes(skill.id);
            const sword = weaponCatalog.find(weapon => weapon.weaponId === skill.weaponId);
            return (
              <button key={skill.id} type="button" aria-pressed={chosen} disabled={!unlocked || (!chosen && skills.length >= ADVENTURE_SKILL_SLOTS)} className={chosen ? "is-chosen" : ""} onClick={() => toggleSkill(skill.id)}>
                <strong>{skill.nameZh}<small className="adventure-skill-role">{skill.roleZh}</small>{skill.weaponId === weaponId && <small className="adventure-skill-own">本命劍</small>}</strong>
                <span>{unlocked ? `靈力 ${skill.qiCost}・${skill.hitMultipliers.length} 連擊` : `解鎖「${sword?.nameZh ?? "仙劍"}」後習得`}</span>
                {unlocked && <em>{skill.description}</em>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
