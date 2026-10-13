import Phaser from 'phaser';
import { BALANCE, ENEMIES, EnemyKind, getEnemyKillTargets } from '../../data/config';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { CombatSystem } from '../systems/CombatSystem';
import { gameState, getPlayerStats } from '../systems/GameState';
import { label, paintChapterArea, floatText } from '../ui/art';
import { Hud, toast } from '../ui/Hud';
import { loadGameAssets, createGameAnimations } from '../assets/assetLoader';
import { getChapterWorldConfig, pickNextEnemyKind } from '../world/ChapterWorld';
import { Projectile } from '../entities/Projectile';
import { BossSystem } from '../systems/BossSystem';
import { PauseOverlay } from '../ui/PauseOverlay';
import { audioManager } from '../audio/AudioManager';
import { recordQuestKills, recordQuestFlag, getHistoricalQuestEnemies, getQuestChapter } from '../rpg/QuestSystem';
import { getQuestInteractions, questInteractionReady } from '../world/QuestInteractions';
import { QUESTS } from '../../data/quests';
import { addAtmosphere } from '../rendering/Atmosphere';
import { graphicsSettings } from '../rendering/GraphicsSettings';
import { getChapterDungeon, dungeonEntryError, grantDungeonKey } from '../rpg/DungeonSystem';

export class ForestScene extends Phaser.Scene {
  private player!: Player;
  private hud!: Hud;
  private combat!: CombatSystem;
  private enemies: Enemy[] = [];
  private bossSpawned = false;
  private projectiles: Projectile[] = [];
  private bossSystem!: BossSystem;
  private pause!: PauseOverlay;
  private interactionLabels: Phaser.GameObjects.Text[] = [];
  private questMarkers: ReturnType<typeof getQuestInteractions> = [];
  private dungeonPosition = { x: 245, y: 165 };
  private areaChapter = 1;

  constructor() { super('Forest'); }

  preload(): void {
    loadGameAssets(this);
  }

  create(data?: { chapter?: unknown }): void {
    this.areaChapter = typeof data?.chapter === 'number' && Number.isInteger(data.chapter)
      && data.chapter >= 1 && data.chapter <= gameState.data.chapter ? data.chapter : gameState.data.chapter;
    createGameAnimations(this);
    this.pause = new PauseOverlay(this);
    const chapterConfig = getChapterWorldConfig(this.areaChapter);
    const explorationMusic = this.areaChapter === 2 ? 'swamp' : this.areaChapter === 3 ? 'mountain' : 'forest';
    audioManager.startMusic(explorationMusic);
    paintChapterArea(this, this.areaChapter);
    addAtmosphere(this, false);
    this.enemies = [];
    this.interactionLabels = [];
    this.questMarkers = getQuestInteractions({ ...gameState.data, chapter: this.areaChapter }, chapterConfig.barriers)
      .filter(marker => QUESTS.some(quest => quest.id === marker.questId && getQuestChapter(quest) === this.areaChapter));
    this.projectiles = [];
    this.bossSpawned = false;
    this.player = new Player(this, chapterConfig.playerSpawn.x, chapterConfig.playerSpawn.y, {
      basic: (step, direction) => this.combat.basic(this.player, step, direction),
      skill: (skill, damage, direction) => this.combat.skill(this.player, skill, damage, direction),
      interact: () => this.interactNearby(),
      dead: animationMs => this.onDeath(animationMs),
    }, () => this.pause.isOpen(), chapterConfig.barriers);
    this.bossSystem = new BossSystem(this, {
      onDefeated: (boss, reward) => this.onBossDefeated(boss.definition.name, reward.xp, reward.gold),
      onPhaseChange: (_boss, phase) => toast(this, phase.transitionNotice, '#ffd587'),
      onPlayerDamaged: (damage) => this.player.hit(damage),
    });
    this.combat = new CombatSystem(this, () => this.enemies, this.bossSystem);
    this.hud = new Hud(this, chapterConfig.name + ' · Đánh J / Né Space / Q / E');
    if (this.hasCombatTasks()) {
      for (const spawn of chapterConfig.enemySpawnPool.initialSpawns) {
        this.spawn(spawn.kind, spawn.x, spawn.y);
      }
    }
    this.time.addEvent({
      delay: chapterConfig.enemySpawnPool.waveIntervalMs,
      loop: true,
      callback: () => {
        if (this.hasCombatTasks() &&
            this.enemies.filter(e => e.isAlive && !e.isBoss).length < chapterConfig.enemySpawnPool.maxConcurrentEnemies) {
          const save = gameState.data;
          const missingTargets = QUESTS.filter(quest => getQuestChapter(quest) < save.chapter && save.rpg.quests[quest.id]?.stage === 'active')
            .flatMap(quest => quest.objectives.filter(objective => objective.kind === 'kill'
              && (save.rpg.quests[quest.id].counts[objective.id] ?? 0) < objective.required).map(objective => objective.target))
            .filter(target => !chapterConfig.enemySpawnPool.wavePool.some(entry => getEnemyKillTargets(entry.kind).includes(target)));
          const historical = getHistoricalQuestEnemies(save).filter(kind => this.areaChapter === save.chapter
            || getEnemyKillTargets(kind).some(target => missingTargets.includes(target)));
          const kind: EnemyKind = historical.length ? historical[Math.floor(Math.random() * historical.length)] : pickNextEnemyKind(this.areaChapter);
          this.spawnRandom(kind);
        }
      },
    });
    this.events.once('shutdown', () => {
      this.pause.destroy();
      for (const projectile of this.projectiles) projectile.destroy();
      this.projectiles = [];
      this.bossSystem.resetEncounter();
      gameState.save();
    });
    toast(this, 'Dọn sạch yêu khí rồi đối đầu với thủ lĩnh chương!');
    const dungeon = getChapterDungeon({ ...gameState.data, chapter: this.areaChapter });
    if (dungeon) {
      this.add.rectangle(this.dungeonPosition.x, this.dungeonPosition.y, 55, 36, 0x242230).setStrokeStyle(3, 0xd2b576)
        .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.enterDungeon());
      label(this, this.dungeonPosition.x, this.dungeonPosition.y - 28, dungeon.name + ' · F', 13, '#ffdda2', 'center');
    }
    for (const marker of this.questMarkers) {
      const rune = this.add.circle(marker.x, marker.y, 15, 0xd1af68, 0.75).setStrokeStyle(2, 0xffe8a6).setDepth(80);
      this.interactionLabels.push(label(this, marker.x, marker.y - 30,
        marker.title.slice(0, 22) + ' · F', 11, '#ffdda2', 'center').setDepth(81).setVisible(false));
      rune.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.interactQuestObject(marker.flag));
    }
  }

  private hasCombatTasks(): boolean {
    const save = gameState.data;
    const dungeon = getChapterDungeon({ ...save, chapter: this.areaChapter });
    return Boolean(dungeon && !save.storyFlags['dungeon-key:' + dungeon.id]) || this.areaChapter === save.chapter && save.quest === 'active' || QUESTS.some(quest => save.rpg.quests[quest.id]?.stage === 'active' && quest.objectives.some(objective => objective.kind === 'kill' && (save.rpg.quests[quest.id].counts[objective.id] ?? 0) < objective.required));
  }

  private interactNearby(): void {
    if (getChapterDungeon({ ...gameState.data, chapter: this.areaChapter }) && Math.hypot(this.player.x - this.dungeonPosition.x, this.player.y - this.dungeonPosition.y) < 75) this.enterDungeon();
    else this.interactQuestObject();
  }

  private enterDungeon(): void {
    if (this.player.isDead || this.pause.isOpen() || Math.hypot(this.player.x - this.dungeonPosition.x, this.player.y - this.dungeonPosition.y) >= 75) return;
    const dungeon = getChapterDungeon({ ...gameState.data, chapter: this.areaChapter });
    if (!dungeon) return;
    const error = dungeonEntryError(gameState.data, dungeon.id, this.areaChapter);
    if (error) { toast(this, error); return; }
    gameState.save();
    this.scene.start('Dungeon', { dungeonId: dungeon.id, chapter: this.areaChapter });
  }

  private interactQuestObject(flag?: string): void {
    if (this.player.isDead || this.pause.isOpen()) return;
    const markers = this.questMarkers;
    const marker = markers.find(entry => (!flag || entry.flag === flag) && Math.hypot(this.player.x - entry.x, this.player.y - entry.y) < 75 && questInteractionReady(gameState.data, entry.questId, entry.flag));
    if (!marker) { toast(this, 'Đến gần vật thiêng và hoàn thành mục tiêu chiến đấu trước khi nhấn F.'); return; }
    gameState.data = recordQuestFlag(gameState.data, marker.flag, this.areaChapter);
    gameState.save();
    audioManager.playCue('item_pickup');
    toast(this, 'Đã hoàn tất: ' + marker.title + '. Về gặp người giao nhiệm vụ.');
  }

  update(time: number, delta: number): void {
    if (this.player.isDead || this.pause.isOpen()) return;
    gameState.tickPlaytime(delta);
    this.player.update(delta);
    for (const hint of this.interactionLabels) {
      hint.setVisible(Math.hypot(hint.x - this.player.x, hint.y + 30 - this.player.y) < 90);
    }
    for (const enemy of this.enemies) enemy.update(time, delta, this.player);
    for (const projectile of this.projectiles) projectile.update(delta);
    this.bossSystem.update(time, delta, {
      x: this.player.x,
      y: this.player.y,
      isDodging: this.player.isDodging,
      canBeHit: this.player.canBeHit,
      hit: (damage) => this.player.hit(damage),
    });
    if (this.player.isDead) return;
    this.enemies = this.enemies.filter(e => e.isAlive);
    this.projectiles = this.projectiles.filter(projectile => projectile.isAlive);
    this.hud.refresh();
    const chapterConfig = getChapterWorldConfig(this.areaChapter);
    const trigger = chapterConfig.portal.triggerZone;
    if (this.player.x <= trigger.maxX && this.player.y >= trigger.minY && this.player.y <= trigger.maxY) {
      gameState.save();
      this.scene.start('Village', { notice: chapterConfig.portal.returnNotice });
      return;
    }
    if (this.areaChapter === gameState.data.chapter && gameState.data.quest === 'active' && gameState.data.kills >= BALANCE.requiredKills &&
        !gameState.data.bossDead && !this.bossSpawned) {
      this.bossSpawned = true;
      audioManager.startMusic(this.areaChapter === 4 ? 'final-boss' : 'boss');
      const boss = this.bossSystem.startEncounter(chapterConfig.bossId, chapterConfig.arenaCenter.x, chapterConfig.arenaCenter.y);
      toast(this, 'NGUY HIỂM! ' + boss.definition.name + ' đã xuất hiện.', '#ffd37b');
    }
  }

  private spawnRandom(kind: EnemyKind): void {
    for (let i = 0; i < 12; i++) {
      const x = Phaser.Math.Between(265, 899);
      const y = Phaser.Math.Between(128, 480);
      if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) > 180) {
        this.spawn(kind, x, y);
        return;
      }
    }
  }

  private spawn(kind: EnemyKind, x: number, y: number): void {
    const enemy = new Enemy(this, kind, x, y, (dead) => this.onEnemyKilled(dead),
      (projectile) => this.projectiles.push(projectile));
    this.enemies.push(enemy);
  }

  private onEnemyKilled(enemy: Enemy): void {
    const before = gameState.data;
    gameState.data = grantDungeonKey(before, enemy.kind);
    const dungeon = getChapterDungeon({ ...gameState.data, chapter: this.areaChapter });
    if (dungeon && !before.storyFlags['dungeon-key:' + dungeon.id] && gameState.data.storyFlags['dungeon-key:' + dungeon.id]) toast(this, 'Đã tìm được chìa khóa: ' + dungeon.name + '.');
    gameState.data = recordQuestKills(gameState.data, getEnemyKillTargets(enemy.kind));
    const stats = ENEMIES[enemy.kind];
    audioManager.playCue('item_pickup', { volume: 0.55 });
    const leveled = gameState.earn(stats.reward, stats.xp);
    floatText(this, enemy.x, enemy.y - 72, `+${stats.reward} đồng  +${stats.xp} XP`, '#ffe7ad');
    if (leveled) toast(this, `LÊN CẤP ${gameState.data.level}! Máu và thần lực được hồi đầy.`);
    if (this.areaChapter === gameState.data.chapter && gameState.data.quest === 'active') {
      gameState.data = { ...gameState.data, kills: gameState.data.kills + 1 };
      if (gameState.data.kills === BALANCE.requiredKills) {
        toast(this, 'Yêu khí tụ lại... Có thứ gì đang thức tỉnh!', '#ffd587');
      }
    }
    gameState.save();
  }

  private onBossDefeated(name: string, xp: number, gold: number): void {
    if (this.areaChapter !== gameState.data.chapter) return;
    gameState.data = recordQuestKills(gameState.data, [getChapterWorldConfig(this.areaChapter).bossId]);
    const leveled = gameState.earn(gold, xp);
    gameState.data = { ...gameState.data, bossDead: true, quest: 'return' };
    if (graphicsSettings.getBudget().cameraShake) this.cameras.main.shake(230, 0.007);
    toast(this, name + ' đã bị tiêu diệt! Trở về báo trưởng làng.', '#fff1b4');
    if (leveled) toast(this, 'LÊN CẤP ' + gameState.data.level + '!', '#ffe7ad');
    gameState.save();
  }

  private onDeath(animationMs: number): void {
    const s = gameState.data;
    const penalty = Math.min(10, s.gold);
    s.gold -= penalty;
    s.hp = getPlayerStats(s).maxHp;
    s.mp = getPlayerStats(s).maxMp;
    gameState.save();
    this.time.delayedCall(animationMs, () => this.scene.start('GameOver'));
  }
}
