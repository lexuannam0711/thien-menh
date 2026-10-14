/**
 * SevenThreeTwoOneRules (Game ID: '7321')
 * Ancient card duel against the dealer (inspired by Blackjack rules).
 * Target: 21 points.
 */

import {
  type Card,
  type HandScore,
  type PublicCard,
  type SevenThreeTwoOnePublicState,
  type SevenThreeTwoOneSecretState,
  type GameOutcome,
  type MinigameResult
} from '../types.js';
import { createShuffledDeck } from '../CSPRNG.js';

export const RULES_VERSION_7321 = '1.0.0';

/**
 * Calculates hand score with optimal Ace handling (1 or 11).
 * Identifies soft hands, bust, and natural 21 (blackjack on initial 2 cards).
 */
export function calculateHandScore(cards: readonly Card[]): HandScore {
  let total = 0;
  let aceCount = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      aceCount++;
      total += 11;
    } else {
      total += card.value;
    }
  }

  while (total > 21 && aceCount > 0) {
    total -= 10;
    aceCount--;
  }

  const isSoft = aceCount > 0 && total <= 21;
  const isBust = total > 21;
  const isNatural21 = cards.length === 2 && total === 21;

  return { total, isSoft, isBust, isNatural21 };
}

export interface InitialDeal7321 {
  publicState: SevenThreeTwoOnePublicState;
  secretState: SevenThreeTwoOneSecretState;
  isResolved: boolean;
  result?: MinigameResult;
}

/**
 * Initiates a new round of 7321:
 * Deals 2 cards to player, 2 cards to dealer (1 face up, 1 face down).
 * Checks for initial Natural 21.
 */
export function dealInitialCards(customDeck?: Card[]): InitialDeal7321 {
  const deck = customDeck ? [...customDeck] : createShuffledDeck();

  if (deck.length < 4) {
    throw new Error('Not enough cards in deck to start 7321 round');
  }

  const playerCard1 = deck.shift()!;
  const dealerCard1 = deck.shift()!; // Upcard
  const playerCard2 = deck.shift()!;
  const dealerCard2 = deck.shift()!; // Hidden card

  const playerHand = [playerCard1, playerCard2];
  const dealerAllCards = [dealerCard1, dealerCard2];

  const playerScore = calculateHandScore(playerHand);
  const dealerScore = calculateHandScore(dealerAllCards);

  // Check Natural 21
  if (playerScore.isNatural21) {
    if (dealerScore.isNatural21) {
      // Tie on both Natural 21
      return {
        publicState: {
          playerHand,
          playerScore,
          dealerHand: dealerAllCards,
          dealerScore,
          turn: 'resolved',
          outcome: 'tie',
          message: 'Cả hai bên đều đạt 21 tự nhiên (Hòa)!'
        },
        secretState: {
          deck,
          dealerHiddenCard: dealerCard2,
          dealerAllCards
        },
        isResolved: true,
        result: {
          outcome: 'tie',
          won: false,
          detail: 'Hai bên đều có 21 tự nhiên.',
          timestamp: Date.now()
        }
      };
    }

    // Player wins with Natural 21
    return {
      publicState: {
        playerHand,
        playerScore,
        dealerHand: dealerAllCards,
        dealerScore,
        turn: 'resolved',
        outcome: 'player_won',
        message: 'Thần Mệnh Thắng! Bạn đạt 21 tự nhiên tuyệt đối!'
      },
      secretState: {
        deck,
        dealerHiddenCard: dealerCard2,
        dealerAllCards
      },
      isResolved: true,
      result: {
        outcome: 'player_won',
        won: true,
        detail: 'Người chơi thắng với 21 tự nhiên (Natural 21).',
        timestamp: Date.now()
      }
    };
  }

  if (dealerScore.isNatural21) {
    // Dealer has Natural 21, Player loses
    return {
      publicState: {
        playerHand,
        playerScore,
        dealerHand: dealerAllCards,
        dealerScore,
        turn: 'resolved',
        outcome: 'dealer_won',
        message: 'Nhà cái đạt 21 tự nhiên! Lượt đấu kết thúc.'
      },
      secretState: {
        deck,
        dealerHiddenCard: dealerCard2,
        dealerAllCards
      },
      isResolved: true,
      result: {
        outcome: 'dealer_won',
        won: false,
        detail: 'Nhà cái đạt 21 tự nhiên.',
        timestamp: Date.now()
      }
    };
  }

  // Active round, dealer hides card 2
  const dealerPublicHand: PublicCard[] = [dealerCard1, { hidden: true }];

  return {
    publicState: {
      playerHand,
      playerScore,
      dealerHand: dealerPublicHand,
      turn: 'player_turn',
      message: 'Lượt của bạn: Rút thêm bài (HIT) hoặc Dừng bài (STAND).'
    },
    secretState: {
      deck,
      dealerHiddenCard: dealerCard2,
      dealerAllCards
    },
    isResolved: false
  };
}

export interface ActionResult7321 {
  publicState: SevenThreeTwoOnePublicState;
  secretState: SevenThreeTwoOneSecretState;
  isResolved: boolean;
  result?: MinigameResult;
}

/**
 * Executes a player action ('hit' or 'stand').
 */
export function executeAction7321(
  currentPublic: SevenThreeTwoOnePublicState,
  currentSecret: SevenThreeTwoOneSecretState,
  actionType: 'hit' | 'stand'
): ActionResult7321 {
  if (currentPublic.turn !== 'player_turn') {
    throw new Error(`Invalid turn state: cannot execute ${actionType} when turn is ${currentPublic.turn}`);
  }

  const deck = [...currentSecret.deck];
  const playerHand = [...currentPublic.playerHand];
  const dealerAllCards = [...currentSecret.dealerAllCards];

  if (actionType === 'hit') {
    if (deck.length === 0) {
      throw new Error('Deck is depleted');
    }
    const newCard = deck.shift()!;
    playerHand.push(newCard);
    const playerScore = calculateHandScore(playerHand);

    if (playerScore.isBust) {
      // Player busted!
      const dealerScore = calculateHandScore(dealerAllCards);
      return {
        publicState: {
          playerHand,
          playerScore,
          dealerHand: dealerAllCards,
          dealerScore,
          turn: 'resolved',
          outcome: 'dealer_won',
          message: `Bạn bị Quắc (${playerScore.total} điểm > 21)!`
        },
        secretState: {
          ...currentSecret,
          deck,
          dealerAllCards
        },
        isResolved: true,
        result: {
          outcome: 'dealer_won',
          won: false,
          detail: `Người chơi bị quắc với ${playerScore.total} điểm.`,
          timestamp: Date.now()
        }
      };
    }

    // Player reached 21 exactly, auto proceed to dealer turn
    if (playerScore.total === 21) {
      return executeDealerTurn(playerHand, playerScore, dealerAllCards, deck, currentSecret);
    }

    // Continue player turn
    return {
      publicState: {
        ...currentPublic,
        playerHand,
        playerScore,
        turn: 'player_turn',
        message: `Bạn đang có ${playerScore.total} điểm. Tiếp tục Rút (HIT) hoặc Dừng (STAND).`
      },
      secretState: {
        ...currentSecret,
        deck
      },
      isResolved: false
    };
  }

  // Action is 'stand'
  return executeDealerTurn(
    playerHand,
    currentPublic.playerScore,
    dealerAllCards,
    deck,
    currentSecret
  );
}

/**
 * Resolves the dealer's turn according to authoritative rules:
 * Dealer draws until reaching at least 17 (stands on all 17s including soft 17).
 */
export function executeDealerTurn(
  playerHand: Card[],
  playerScore: HandScore,
  dealerCards: Card[],
  deck: Card[],
  secretState: SevenThreeTwoOneSecretState
): ActionResult7321 {
  const currentDealerCards = [...dealerCards];
  let dealerScore = calculateHandScore(currentDealerCards);

  // Dealer stands on soft 17 and hard 17+
  while (dealerScore.total < 17 && deck.length > 0) {
    const card = deck.shift()!;
    currentDealerCards.push(card);
    dealerScore = calculateHandScore(currentDealerCards);
  }

  let outcome: GameOutcome;
  let won: boolean;
  let message: string;
  let detail: string;

  if (dealerScore.isBust) {
    outcome = 'player_won';
    won = true;
    message = `Nhà cái bị Quắc (${dealerScore.total} điểm)! Bạn giành chiến thắng!`;
    detail = `Nhà cái quắc (${dealerScore.total}), người chơi thắng (${playerScore.total}).`;
  } else if (playerScore.total > dealerScore.total) {
    outcome = 'player_won';
    won = true;
    message = `Bạn thắng! ${playerScore.total} điểm cao hơn ${dealerScore.total} điểm của Nhà cái!`;
    detail = `Người chơi (${playerScore.total}) thắng Nhà cái (${dealerScore.total}).`;
  } else if (playerScore.total < dealerScore.total) {
    outcome = 'dealer_won';
    won = false;
    message = `Nhà cái thắng! ${dealerScore.total} điểm cao hơn ${playerScore.total} điểm của bạn.`;
    detail = `Nhà cái (${dealerScore.total}) thắng người chơi (${playerScore.total}).`;
  } else {
    outcome = 'tie';
    won = false;
    message = `Hòa điểm! Cả hai bên đều có ${playerScore.total} điểm.`;
    detail = `Hòa điểm ${playerScore.total} - ${dealerScore.total}.`;
  }

  return {
    publicState: {
      playerHand,
      playerScore,
      dealerHand: currentDealerCards,
      dealerScore,
      turn: 'resolved',
      outcome,
      message
    },
    secretState: {
      ...secretState,
      deck,
      dealerAllCards: currentDealerCards
    },
    isResolved: true,
    result: {
      outcome,
      won,
      detail,
      timestamp: Date.now()
    }
  };
}
