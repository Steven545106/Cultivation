import Phaser from "phaser";
import { weaponCatalog, type WeaponConfig } from "../../features/weapon";
import type { GameRuntime } from "../GameRuntime";
import { BaiXiaochun } from "../characters/BaiXiaochun";
import { AttackRunner } from "../combat/AttackRunner";
import { CombatVfxRenderer } from "../combat/CombatVfxRenderer";
import { HitStop } from "../combat/HitStop";
import { WeaponDebugOverlay } from "../combat/WeaponDebugOverlay";
import { WeaponAttachmentController, type BladeSegment } from "../weapons/WeaponAttachmentController";
import { applyWeaponCalibration } from "../weapons/WeaponCalibration";
import {
  createAttackPlan,
  getActiveSweepAngles,
  getAttackPlaybackRate,
  getComboMove,
  getFinalAttackSpeed,
  getSweepHitRadius,
  MONSTER_HIT_RADIUS,
  resolveHitDamage,
  resolveSweepHit,
  type AttackPlan,
  type FinalCombatStats,
  type Point,
} from "../../features/combat";
import { getFloorTitle, getTowerTheme, type TowerChallengeState } from "../../features/tower";
import {
  applyMonsterDamage,
  createTrainingDummy,
  formatTrainingDummyLabel,
  getMonsterHealthRatio,
  TRAINING_DUMMY_RESPAWN_MS,
  type MonsterState,
} from "../../features/monster";
import { MonsterView } from "../monsters/MonsterView";
import { monsterAssetPaths } from "../monsters/monsterAssetManifest";
import { monsterAnimations, monsterSheetKey } from "../monsters/monsterAnimationConfig";
import { themedMonsters, themedMonsterSheetKey } from "../monsters/themedMonsters";
import { loadRig, PLAYER, PLAZA_WEAPON_SCALE, preloadRig } from "./battleLayout";
import { BeastView } from "../beasts/BeastView";
import { BEAST_ATTACK_INTERVAL_MS, beastCatalog, getBeastAttackDamage } from "../../features/beast";
import { isCurrentBeastAttack } from "../../features/beast/domain/BeastAttackTarget";
import { TowerAmbience } from "../tower/TowerAmbience";
import { TowerCeremony } from "../tower/TowerCeremony";

/** Degrees of idle blade sway between attacks. */
const IDLE_BLADE_SWAY = 2.5;
// Initial monster home; positionMonsterForWeapon re-homes it onto each
// weapon's real active sweep, and the hit test follows that home.
const MONSTER = new Phaser.Math.Vector2(880, 200);
/** The combo finisher holds its impact longer. */
const FINISHER_HIT_STOP_SCALE = 2;
/** The deployed beast stands behind and to the left of the hero, on his ground line. */
const BEAST_HOME = new Phaser.Math.Vector2(PLAYER.x - 118, PLAYER.y + 88);

/**
 * Dedicated animation-test scene. It only assembles the hero, weapon, monster
 * view and VFX; attack timing, hit tests and damage come from features/combat.
 */
export function createWeaponPreviewScene(runtime: GameRuntime): typeof Phaser.Scene {
  return class WeaponPreviewScene extends Phaser.Scene {
    private hero!: BaiXiaochun;
    private attachment!: WeaponAttachmentController;
    private runner!: AttackRunner;
    private vfx!: CombatVfxRenderer;
    private debug!: WeaponDebugOverlay;
    private hitStop!: HitStop;
    private monster!: MonsterView;
    private beast!: BeastView;
    /** Battle ms until the deployed beast's next attack. */
    private beastAttackInMs = BEAST_ATTACK_INTERVAL_MS;
    private equipped = runtime.weaponLoadout.getEquipped();
    private pendingWeapon: WeaponConfig | null = null;
    /** Battle ms until the next automatic attack; null while one is running. */
    private nextAttackInMs: number | null = null;
    private attacking = false;
    /** The displayed target's HP state: the training dummy, mirrored from the tower while a challenge runs. */
    private target: MonsterState = createTrainingDummy();
    private respawnTimer?: number;
    private towerChallenge: TowerChallengeState | null = null;
    private refinementLevel = -1;
    /** 1 on the training dummy; the player's tower speed (2×/3×/5×) while a tower challenge is running. */
    private battleSpeed = 1;
    /** Attacks since the sword was equipped; picks the next move of its combo. */
    private comboIndex = 0;
    private ambience!: TowerAmbience;
    private ceremony!: TowerCeremony;
    /** The last stage whose entrance was announced, so a retry or a farm of the same stage stays quiet. */
    private announcedStage: number | null = null;
    private announcedFloor: number | null = null;
    private celebratedAttempt: number | null = null;

    public constructor() { super("WeaponPreviewScene"); }

    public preload(): void {
      this.load.image("bai-xiaochun", "/assets/player/cultivator-chibi.webp");
      // Without the rig manifest (or with a missing part) the hero falls back to the single PNG.
      preloadRig(this);
      weaponCatalog.forEach(weapon => this.load.image(weapon.spriteKey, weapon.assetPath));
      monsterAssetPaths.forEach((assetPath, index) => this.load.image(`tower-monster-${index}`, assetPath));
      Object.keys(monsterAnimations).forEach(name => this.load.spritesheet(
        monsterSheetKey(name), `/assets/monster-animation/${name}.png`, { frameWidth: 512, frameHeight: 512 },
      ));
      Object.entries(themedMonsters).forEach(([themeId, monster]) => this.load.spritesheet(themedMonsterSheetKey(themeId), monster.sheetPath, { frameWidth: 512, frameHeight: 512 }));
      beastCatalog.forEach(beast => this.load.image(beast.textureKey, beast.assetPath));
    }

    public create(): void {
      // 1920x1080 physical canvas, preserving the established 1280x720 scene layout.
      this.cameras.main.setZoom(1.5).setScroll(-320, -180);
      // The hero owns its ground shadow so it can follow lunges.
      this.hero = new BaiXiaochun(this, PLAYER, loadRig(this), this.add.ellipse(PLAYER.x, PLAYER.y + 88, 230, 46, 0x000000, 0.2));
      this.attachment = new WeaponAttachmentController(this);
      this.runner = new AttackRunner();
      this.vfx = new CombatVfxRenderer(this);
      this.debug = new WeaponDebugOverlay(this);
      this.hitStop = new HitStop(this);
      this.monster = new MonsterView(this, MONSTER, PLAYER.y + 88, formatTrainingDummyLabel(this.target));
      this.beast = new BeastView(this, BEAST_HOME);
      this.beast.setBeast(runtime.getDeployedBeast());
      this.ambience = new TowerAmbience(this);
      this.ambience.setTheme(getTowerTheme(1));
      this.ceremony = new TowerCeremony(this);
      this.setWeapon(this.equipped);
      this.scheduleAutoAttack(260);

      const unsubscribeWeapon = runtime.weaponLoadout.subscribe(weapon => this.selectWeapon(weapon));
      const unsubscribeCalibration = runtime.subscribeToCalibration(() => { if (!this.attacking) this.setWeapon(this.equipped); });
      const unsubscribeTower = runtime.subscribeToTowerChallenge(challenge => this.syncTowerChallenge(challenge));
      const unsubscribeTowerSpeed = runtime.subscribeToTowerBattleSpeed(() => this.syncBattleSpeed());
      const unsubscribeBeast = runtime.subscribeToDeployedBeast(beast => this.beast.setBeast(beast));
      this.syncTowerChallenge(runtime.getTowerChallenge());
      this.syncRefinementVfx();
      this.events.on(Phaser.Scenes.Events.UPDATE, (time: number, delta: number) => {
        const battleDelta = delta * this.battleSpeed;
        this.hero.update(time / 1000, battleDelta);
        this.monster.update(time / 1000);
        runtime.advanceBattleTime(battleDelta);
        this.advanceAttacks(battleDelta);
        this.beast.update(time / 1000);
        this.advanceBeast(battleDelta);
        runtime.settleTowerChallenge();
        this.syncRefinementVfx();
        // Between attacks the sword follows the breathing fist with a slow sway, instead of hanging frozen.
        if (!this.attacking && this.hero.isRigged) {
          const weapon = this.getCalibratedWeapon(this.equipped);
          this.syncWeapon(weapon, weapon.socketOffset.rotation + IDLE_BLADE_SWAY * Math.sin(time / 1000 * 1.6));
        }
      });
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        unsubscribeWeapon();
        unsubscribeCalibration();
        unsubscribeTower();
        unsubscribeTowerSpeed();
        unsubscribeBeast();
        this.runner.cancel();
        this.ambience.destroy();
        if (this.respawnTimer !== undefined) window.clearTimeout(this.respawnTimer);
        this.hitStop.dispose();
      });
    }

    /** Selecting a weapon is the test scene's attack trigger; there is no attack button. */
    private selectWeapon(weapon: WeaponConfig): void {
      if (this.attacking) {
        this.pendingWeapon = weapon;
        return;
      }
      this.setWeapon(weapon);
      this.scheduleAutoAttack(90);
    }

    private setWeapon(weapon: WeaponConfig): void {
      if (weapon.weaponId !== this.equipped.weaponId) this.comboIndex = 0;
      this.equipped = weapon;
      const calibrated = this.getCalibratedWeapon(weapon);
      this.attachment.equip(calibrated);
      this.positionMonsterForWeapon(calibrated);
      this.syncWeapon(calibrated, calibrated.socketOffset.rotation);
    }

    private attack(): void {
      if (this.attacking) return;
      this.attacking = true;
      const weapon = this.getCalibratedWeapon(this.equipped);
      // Capture once so a mid-swing weapon change cannot alter this hit's stats.
      const stats = runtime.getCombatStats();
      let hit = false;
      const move = getComboMove(weapon.weaponType, this.comboIndex);
      this.comboIndex += 1;
      const plan = createAttackPlan(weapon, getFinalAttackSpeed(weapon.attackSpeed, stats), move);
      this.runner.run(plan, {
        onPhaseProgress: (phase, progress) => this.hero.setAttackPhase(plan.clip, phase, progress),
        syncWeapon: angle => this.syncWeapon(weapon, angle),
        setBodyWeight: weight => this.hero.setAttackWeight(weight),
        resetPose: () => this.hero.resetPose(),
        playbackRate: () => getAttackPlaybackRate(runtime.calibration.playbackRate),
        onWindupSample: (segment, progress) => this.vfx.chargeWindup(segment, weapon, progress),
        onSwingSample: (previous, current, progress) => {
          this.vfx.recordSwing(previous, current, weapon, this.attachment.getSpriteState());
          if (resolveSweepHit({
            alreadyHit: hit,
            targetAlive: this.isTargetAlive(),
            timeline: plan,
            progress,
            previous,
            current,
            targetCentre: this.monster.home,
            hitRadius: getSweepHitRadius(weapon.hitboxConfig.thickness, MONSTER_HIT_RADIUS),
          })) {
            hit = true;
            this.impact(weapon, stats, plan, this.getContactPoint(current.tip));
          }
        },
        onFinished: cooldownMs => {
          this.vfx.endSwing();
          this.attacking = false;
          const pending = this.pendingWeapon;
          this.pendingWeapon = null;
          if (pending) {
            this.selectWeapon(pending);
          } else {
            this.scheduleAutoAttack(cooldownMs);
          }
        },
      });
    }

    private impact(weapon: WeaponConfig, stats: FinalCombatStats | null, plan: AttackPlan, position: Phaser.Math.Vector2): void {
      if (!this.isTargetAlive()) return;
      const result = resolveHitDamage(stats, weapon.baseDamage, Math.random(), plan.damageMultiplier);
      this.vfx.playImpact(weapon, result, position, plan.finisher);
      if (this.towerChallenge) {
        runtime.applyTowerDamage(result.damage);
      } else {
        this.applyDummyDamage(result.damage, weapon);
      }
      this.hitStop.apply(weapon.impactConfig.hitStopMs * (plan.finisher ? FINISHER_HIT_STOP_SCALE : 1));
    }

    /** Tweens (the swing), timers (attack cooldown) and the battle clock all follow one speed. */
    private setBattleSpeed(speed: number): void {
      if (speed === this.battleSpeed) return;
      this.battleSpeed = speed;
      this.tweens.timeScale = speed;
      this.hitStop.setBaseScale(speed);
    }

    /** The deployed beast attacks on the battle clock, only while a tower challenge is running. */
    private advanceBeast(battleDelta: number): void {
      const beast = this.beast.current;
      if (!beast || this.towerChallenge?.status !== "active") {
        this.beastAttackInMs = BEAST_ATTACK_INTERVAL_MS;
        return;
      }
      this.beastAttackInMs -= battleDelta;
      if (this.beastAttackInMs > 0) return;
      this.beastAttackInMs += BEAST_ATTACK_INTERVAL_MS;
      const heroDps = runtime.getCombatStats()?.dps ?? 0;
      if (heroDps <= 0) return;
      const targetChallenge = this.towerChallenge;
      this.beast.attack(this.monster.home, position => {
        const current = this.towerChallenge;
        if (!this.isTargetAlive() || !isCurrentBeastAttack(
          { startedAt: targetChallenge.startedAt, stageNumber: targetChallenge.stage.stageNumber, beastId: beast.beastId },
          current && { startedAt: current.startedAt, stageNumber: current.stage.stageNumber, beastId: this.beast.current?.beastId ?? null, active: current.status === "active" },
        )) return;
        const damage = getBeastAttackDamage(beast, heroDps, runtime.getDeployedBeastStage());
        this.beast.playHit(position, damage);
        this.monster.playKnockback(10, 60);
        runtime.applyTowerDamage(damage);
      });
    }

    private syncBattleSpeed(): void {
      this.setBattleSpeed(this.towerChallenge?.status === "active" ? runtime.getTowerBattleSpeed() : 1);
    }

    private isTargetAlive(): boolean {
      return this.target.status !== "dead";
    }

    private applyDummyDamage(damage: number, weapon: WeaponConfig): void {
      this.target = applyMonsterDamage(this.target, damage);
      this.monster.setHealth(getMonsterHealthRatio(this.target), formatTrainingDummyLabel(this.target));
      this.monster.playKnockback(weapon.impactConfig.knockback, 85);

      if (this.isTargetAlive()) return;
      this.monster.playDefeat(0.65, 32);
      this.respawnTimer = window.setTimeout(() => {
        if (this.sys.isActive()) this.respawnDummy();
      }, TRAINING_DUMMY_RESPAWN_MS);
    }

    private respawnDummy(): void {
      this.respawnTimer = undefined;
      this.target = createTrainingDummy();
      this.monster.reset();
      this.monster.setHealth(1, formatTrainingDummyLabel(this.target));
    }

    /** Leaving a tower challenge returns the scene to a fresh training dummy, not the tower's leftover HP. */
    private restoreTrainingDummy(): void {
      this.respawnDummy();
      this.monster.setTexture(1);
      this.monster.drawDecoration(false);
      this.ambience.setTheme(getTowerTheme(1));
      this.announcedStage = null;
      this.announcedFloor = null;
    }

    /** Phaser only renders tower monster state; tower rules and HP live in the domain module. */
    private syncTowerChallenge(challenge: TowerChallengeState | null): void {
      const previousChallenge = this.towerChallenge;
      const wasTowerChallenge = previousChallenge !== null;
      this.towerChallenge = challenge;
      this.syncBattleSpeed();
      if (!challenge) {
        if (wasTowerChallenge) this.restoreTrainingDummy();
        return;
      }
      if (this.respawnTimer !== undefined) {
        window.clearTimeout(this.respawnTimer);
        this.respawnTimer = undefined;
      }
      const { monster, stage, status } = challenge;
      // Mirror tower HP/aliveness into the displayed target for hit gating;
      // restoreTrainingDummy replaces it once the challenge ends.
      const alive = status === "active" && monster.currentHp > 0;
      this.target = { ...this.target, currentHp: monster.currentHp, status: alive ? "idle" : "dead" };
      this.monster.setHealth(getMonsterHealthRatio(monster), `${monster.nameZh}　${monster.currentHp} / ${monster.maxHp}`);
      // Only reset visuals for a new attempt; each HP update must not restart death/impact tweens.
      if (!wasTowerChallenge || challenge.startedAt !== previousChallenge?.startedAt || stage.stageNumber !== previousChallenge?.stage.stageNumber) {
        this.monster.reset(stage.isBoss ? 1.18 : 1);
        const theme = getTowerTheme(stage.floor);
        this.monster.setTexture(stage.stageNumber, theme.id, stage.isBoss);
        this.monster.drawDecoration(stage.isBoss);
        this.ambience.setTheme(theme);
        // Announce a stage once: a retry, or farming the same stage again, stays quiet.
        if (stage.stageNumber !== this.announcedStage) {
          this.announcedStage = stage.stageNumber;
          if (stage.floor !== this.announcedFloor) {
            this.announcedFloor = stage.floor;
            this.ceremony.floorTitle(getFloorTitle(stage.floor), theme.nameZh);
          }
          if (stage.isBoss) this.ceremony.bossEntrance(monster.nameZh);
          else if (stage.monsterKind === "elite") this.ceremony.eliteEntrance(monster.nameZh);
        }
      }
      if (status === "cleared") {
        this.monster.setLabel(`${monster.nameZh}　已擊敗`);
        this.monster.playDefeat(0.7, 28);
        if (this.celebratedAttempt !== challenge.startedAt) {
          this.celebratedAttempt = challenge.startedAt;
          this.ceremony.victory(this.monster.home, stage.isBoss);
        }
      } else if (monster.status === "hit") {
        this.monster.playKnockback(18, 65);
      }
      if (status === "failed") this.monster.setLabel(`${monster.nameZh}　挑戰逾時`);
    }

    private getContactPoint(tip: Point): Phaser.Math.Vector2 {
      const home = this.monster.home;
      return home.clone().subtract(tip).normalize().scale(-MONSTER_HIT_RADIUS).add(home);
    }

    /**
     * The dedicated test target is placed on the configured weapon's real
     * active sweep. This lets every uncalibrated asset be tested without
     * substituting a fixed forward hit box.
     */
    private positionMonsterForWeapon(weapon: WeaponConfig): void {
      const angles = getActiveSweepAngles(weapon.attackTimeline, weapon.socketOffset.rotation, createAttackPlan(weapon).swing.ease);
      const start = this.attachment.sync(this.getHandAt(weapon, angles.start), angles.start);
      const end = this.attachment.sync(this.getHandAt(weapon, angles.end), angles.end);
      const point = new Phaser.Math.Vector2(
        Phaser.Math.Linear(start.tip.x, end.tip.x, 0.55),
        Phaser.Math.Linear(start.tip.y, end.tip.y, 0.55),
      );
      this.monster.setHome(Phaser.Math.Clamp(point.x, 650, 1040), Phaser.Math.Clamp(point.y, 150, 480));
    }

    private scheduleAutoAttack(delayMs: number): void {
      this.nextAttackInMs = delayMs;
    }

    /** Spends one frame of battle time on attacks and cooldowns, carrying leftovers across them. */
    private advanceAttacks(deltaMs: number): void {
      let budget = deltaMs;
      // Bounded so a huge delta (tab restored after minutes) cannot spin forever.
      for (let guard = 0; budget > 0 && guard < 64; guard += 1) {
        if (this.runner.isRunning) {
          budget = this.runner.advance(budget);
        } else if (this.nextAttackInMs === null) {
          return;
        } else if (this.nextAttackInMs > budget) {
          this.nextAttackInMs -= budget;
          return;
        } else {
          budget -= this.nextAttackInMs;
          this.nextAttackInMs = null;
          this.attack();
        }
      }
    }

    private getCalibratedWeapon(weapon: WeaponConfig): WeaponConfig {
      return applyWeaponCalibration(weapon, runtime.getWeaponCalibration(weapon.weaponId), PLAZA_WEAPON_SCALE);
    }

    /** Moves the sword arm to follow the blade, then returns the grip point for that blade angle. */
    private getHandAt(weapon: WeaponConfig, angle: number): Phaser.Math.Vector2 {
      this.hero.setBladeOffset(angle - weapon.socketOffset.rotation);
      // The weapon sprite points down at 0°, so its blade direction is the angle plus its rotation offset.
      this.hero.setBladeDirection(angle + weapon.rotationOffset);
      const calibration = runtime.getWeaponCalibration(weapon.weaponId);
      return this.hero.getHand(weapon.socketOffset, { x: calibration.offsetX, y: calibration.offsetY });
    }

    private syncWeapon(weapon: WeaponConfig, angle: number): BladeSegment {
      const hand = this.getHandAt(weapon, angle);
      const segment = this.attachment.sync(hand, angle);
      this.hero.layerWeapon(this.attachment);
      this.debug.draw(hand, segment, weapon.hitboxConfig.thickness, runtime.calibration);
      this.vfx.syncWeaponGlow(this.attachment.getSpriteState(), weapon);
      return segment;
    }

    /** React publishes the equipped sword's refinement in its combat stats; follow it each frame. */
    private syncRefinementVfx(): void {
      const level = runtime.getCombatStats()?.refinementLevel ?? 0;
      if (level === this.refinementLevel) return;
      this.refinementLevel = level;
      this.vfx.setRefinementLevel(level);
      if (this.attacking) return;
      const weapon = this.getCalibratedWeapon(this.equipped);
      this.syncWeapon(weapon, weapon.socketOffset.rotation);
    }
  };
}
