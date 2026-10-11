import Phaser from 'phaser';
import { BALANCE, PALETTE, W, H, UI_DEPTH } from '../../data/config';
import { Player } from '../entities/Player';
import { CombatSystem } from '../systems/CombatSystem';
import { gameState } from '../systems/GameState';
import { actor, button, label, paintVillage } from '../ui/art';
import { Hud, toast } from '../ui/Hud';

interface NpcInfo { name: string; x: number; y: number; color: number; }
interface Choice { title: string; select: () => void; }

export class VillageScene extends Phaser.Scene {
  private player!: Player;
  private hud!: Hud;
  private combat!: CombatSystem;
  private overlay: Phaser.GameObjects.Container | null = null;
  private npcs: NpcInfo[] = [
    { name: 'Trưởng làng', x: 290, y: 263, color: 0xc0a275 },
    { name: 'Thợ rèn', x: 518, y: 309, color: 0xc27f61 },
    { name: 'Bà Mo', x: 697, y: 271, color: 0x8576aa },
  ];

  constructor() { super('Village'); }

  create(data?: { notice?: string }): void {
    this.overlay = null;
    paintVillage(this);
    this.npcs.forEach((npc) => {
      actor(this, npc.x, npc.y, npc.color, npc.name, 19);
      this.add.text(npc.x, npc.y + 25, 'F: NÓI', { fontSize: '12px', color: '#fff3cb',
        backgroundColor: '#1c392a' }).setOrigin(0.5).setDepth(110);
      this.add.zone(npc.x, npc.y, 78, 90).setInteractive({ useHandCursor: true })
        .setDepth(100).on('pointerdown', () => {
          if (!this.overlay && Phaser.Math.Distance.Between(this.player.x, this.player.y,
            npc.x, npc.y) < 118) this.interact(npc.name);
          else if (!this.overlay) toast(this, 'Đến gần NPC để trò chuyện.');
        });
    });
    this.combat = new CombatSystem(this, () => []);
    const fromForest = gameState.data.quest !== 'new' && Boolean(data?.notice);
    this.player = new Player(this, fromForest ? 820 : 406, 347, {
      basic: (step, direction) => this.combat.basic(this.player, step, direction),
      earth: () => this.combat.earth(this.player),
      flame: (direction) => this.combat.flame(this.player, direction),
      interact: () => this.interactClosest(),
      dead: () => this.onDeath(),
    }, () => Boolean(this.overlay));
    this.hud = new Hud(this, 'An toàn · Trưởng làng / Thợ rèn / Bà Mo');
    if (data?.notice) this.time.delayedCall(250, () => toast(this, data.notice!));
    this.events.once('shutdown', () => gameState.save());
  }

  update(_time: number, delta: number): void {
    if (this.overlay) return;
    this.player.update(delta);
    this.hud.refresh();
    if (this.player.x > 912 && this.player.y > 193 && this.player.y < 344) {
      if (gameState.data.quest === 'new') {
        this.player.view.x = 885;
        toast(this, 'Hãy nhận nhiệm vụ từ trưởng làng trước.');
      } else {
        gameState.save();
        this.scene.start('Forest');
      }
    }
  }

  private interactClosest(): void {
    let best: NpcInfo | null = null;
    let bestDistance = 110;
    for (const npc of this.npcs) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
      if (distance < bestDistance) { bestDistance = distance; best = npc; }
    }
    if (best) this.interact(best.name);
    else toast(this, 'Lại gần một người dân và nhấn F.');
  }

  private interact(name: string): void {
    if (this.overlay) return;
    if (name === 'Trưởng làng') return this.leader();
    if (name === 'Thợ rèn') return this.smith();
    this.shaman();
  }

  private leader(): void {
    const s = gameState.data;
    if (s.quest === 'new') {
      this.modal('TRƯỞNG LÀNG LẠC',
        'Con là người đã nhận Thiên Mệnh Ấn. Rừng Trúc đang có yêu khí.\nHãy diệt 6 quái và đánh bại Hổ Yêu U Minh để bảo vệ dân làng.', [
          { title: 'Nhận nhiệm vụ', select: () => {
            s.quest = 'active'; gameState.save(); this.closeModal();
            toast(this, 'Đã nhận nhiệm vụ: Thanh tẩy Rừng Trúc.');
          } },
          { title: 'Để sau', select: () => this.closeModal() },
        ]);
    } else if (s.quest === 'active') {
      this.modal('TRƯỞNG LÀNG LẠC',
        `Con đã hạ ${Math.min(s.kills, BALANCE.requiredKills)}/${BALANCE.requiredKills} quái.\n` +
          'Đừng quên chém liên hoàn và dùng thần lực. Hổ Yêu sẽ xuất hiện khi rừng được thanh tẩy.', [
            { title: 'Con đã hiểu', select: () => this.closeModal() },
          ]);
    } else if (s.quest === 'return') {
      this.modal('TRƯỞNG LÀNG LẠC',
        'Con đã cứu cả ngôi làng! Sứ giả từ Phong Châu vừa tới.\nVua Hùng thứ 18 truyền lệnh triệu kiến người mang Thiên Mệnh Ấn.', [
          { title: 'Báo cáo & nhận thưởng', select: () => {
            s.quest = 'complete';
            gameState.earn(50, 120);
            gameState.save();
            this.closeModal();
            this.scene.start('Victory');
          } },
          { title: 'Để con chuẩn bị', select: () => this.closeModal() },
        ]);
    } else {
      this.modal('TRƯỞNG LÀNG LẠC',
        'Cả làng biết ơn con. Nhưng đây chỉ là khởi đầu. Thần mệnh vẫn đang gọi từ Phong Châu.', [
          { title: 'Đã hiểu', select: () => this.closeModal() },
        ]);
    }
  }

  private smith(): void {
    const s = gameState.data;
    const price = BALANCE.smithCost * (s.upgrades + 1);
    this.modal('THỢ RÈN ĐÚC',
      `Đồ đồng cần được tôi luyện!\nSức tấn công hiện tại: ${s.attack}. Tiền đồng: ${s.gold}.\nNâng giáo +${BALANCE.smithAttackGain} công, giá ${price} đồng.`, [
        { title: `Nâng cấp giáo (${price} đồng)`, select: () => {
          if (s.gold < price) { this.closeModal(); toast(this, 'Chưa đủ tiền đồng, hãy săn quái.'); return; }
          s.gold -= price;
          s.attack += BALANCE.smithAttackGain;
          s.upgrades += 1;
          gameState.save();
          this.closeModal();
          toast(this, `Giáo đồng được nâng cấp! Công: ${s.attack}`);
        } },
        { title: 'Trò chuyện', select: () => {
          this.closeModal();
          this.modal('THỢ RÈN ĐÚC',
            'Hoa văn trên cây giáo này giống họa tiết trên trống đồng. Hãy dùng nó để giữ yên bản làng.', [
              { title: 'Cảm ơn bác', select: () => this.closeModal() },
            ]);
        } },
        { title: 'Rời đi', select: () => this.closeModal() },
      ]);
  }

  private shaman(): void {
    const s = gameState.data;
    this.modal('BÀ MO',
      `Thiên Mệnh Ấn sáng khi con đối mặt nguy hiểm.\nMáu: ${Math.ceil(s.hp)}/${s.maxHp} · Thần lực: ${Math.ceil(s.mp)}/${s.maxMp}.`, [
        { title: 'Hồi phục hoàn toàn (8 đồng)', select: () => {
          if (s.gold < 8) { this.closeModal(); toast(this, 'Cần 8 đồng để chuẩn bị thảo dược.'); return; }
          s.gold -= 8;
          s.hp = s.maxHp;
          s.mp = s.maxMp;
          gameState.save(); this.closeModal();
          toast(this, 'Linh dược đã hồi phục máu và thần lực.');
        } },
        { title: 'Hỏi về thần lực', select: () => {
          this.closeModal();
          this.modal('BÀ MO', 'Q: Địa Chấn gây sát thương quanh người.\nE: Hỏa Trảm tấn công theo hướng nhìn.\nCần giữ thần lực cho lúc quái vây đông.', [
            { title: 'Đã hiểu', select: () => this.closeModal() },
          ]);
        } },
        { title: 'Rời đi', select: () => this.closeModal() },
      ]);
  }

  private modal(title: string, dialogue: string, choices: Choice[]): void {
    const backdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x081917, 0.75)
      .setInteractive();
    const frame = this.add.rectangle(480, 273, 750, 375, 0x1b3a32)
      .setStrokeStyle(3, PALETTE.bronze);
    const heading = label(this, 480, 139, title, 26, '#ffdda2', 'center');
    const body = label(this, 480, 205, dialogue, 18, '#f5ead2', 'center')
      .setWordWrapWidth(685);
    const items: Phaser.GameObjects.GameObject[] = [backdrop, frame, heading, body];
    choices.forEach((choice, index) => {
      const item = button(this, 480, 297 + index * 52, 455, choice.title, choice.select,
        index === 0 ? 0x8c653d : 0x385a4c);
      items.push(item);
    });
    this.overlay = this.add.container(0, 0, items).setDepth(UI_DEPTH + 100);
  }

  private closeModal(): void { this.overlay?.destroy(true); this.overlay = null; }

  private onDeath(): void {
    gameState.data.hp = gameState.data.maxHp;
    gameState.data.mp = gameState.data.maxMp;
    gameState.save();
    this.scene.restart({ notice: 'Được đưa trở về làng để dưỡng thương.' });
  }
}
