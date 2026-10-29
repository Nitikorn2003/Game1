import { readFileSync } from 'node:fs';
import { z } from 'zod';

// Google Play product IDs start with a lowercase letter or digit and contain only
// lowercase letters, digits, underscores and periods.
const productIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._]{0,138}$/, 'invalid Google Play product id');
const currencySchema = z.string().regex(/^[a-z][a-z0-9_]{0,31}$/, 'invalid currency code');
const entitlementSchema = z.string().regex(/^[a-z][a-z0-9_.]{0,63}$/, 'invalid entitlement id');

const consumableSchema = z.object({
  productId: productIdSchema,
  type: z.literal('consumable'),
  /** Currency credited per purchased unit, e.g. {"gems": 100}. */
  grants: z
    .record(currencySchema, z.number().int().positive().max(1_000_000_000))
    .refine((grants) => Object.keys(grants).length > 0, 'a consumable must grant at least one currency'),
});

const nonConsumableSchema = z.object({
  productId: productIdSchema,
  type: z.literal('non_consumable'),
  entitlement: entitlementSchema,
});

const productSchema = z.discriminatedUnion('type', [consumableSchema, nonConsumableSchema]);

const gameSchema = z.object({
  gameId: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, 'invalid game id'),
  packageName: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/, 'invalid Android package name'),
  products: z.array(productSchema).min(1),
});

const catalogSchema = z
  .object({ games: z.array(gameSchema).min(1) })
  .superRefine((catalog, ctx) => {
    const ids = new Set<string>();
    const packages = new Set<string>();
    for (const game of catalog.games) {
      if (ids.has(game.gameId)) ctx.addIssue({ code: 'custom', message: `duplicate gameId ${game.gameId}` });
      if (packages.has(game.packageName)) {
        ctx.addIssue({ code: 'custom', message: `duplicate packageName ${game.packageName}` });
      }
      ids.add(game.gameId);
      packages.add(game.packageName);
      const productIds = new Set<string>();
      for (const product of game.products) {
        if (productIds.has(product.productId)) {
          ctx.addIssue({ code: 'custom', message: `duplicate productId ${product.productId} in ${game.gameId}` });
        }
        productIds.add(product.productId);
      }
    }
  });

export type ProductConfig = z.infer<typeof productSchema>;
export type ConsumableProduct = z.infer<typeof consumableSchema>;
export type NonConsumableProduct = z.infer<typeof nonConsumableSchema>;
export type GameConfig = z.infer<typeof gameSchema>;

export class Catalog {
  private readonly byId = new Map<string, GameConfig>();
  private readonly byPackage = new Map<string, GameConfig>();

  constructor(games: GameConfig[]) {
    for (const game of games) {
      this.byId.set(game.gameId, game);
      this.byPackage.set(game.packageName, game);
    }
  }

  static parse(input: unknown): Catalog {
    return new Catalog(catalogSchema.parse(input).games);
  }

  static load(path: string): Catalog {
    return Catalog.parse(JSON.parse(readFileSync(path, 'utf8')));
  }

  get games(): GameConfig[] {
    return [...this.byId.values()];
  }

  gameById(gameId: string): GameConfig | undefined {
    return this.byId.get(gameId);
  }

  gameByPackage(packageName: string): GameConfig | undefined {
    return this.byPackage.get(packageName);
  }

  product(game: GameConfig, productId: string): ProductConfig | undefined {
    return game.products.find((p) => p.productId === productId);
  }
}
