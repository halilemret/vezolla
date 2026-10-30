import { z } from "zod";

export const ATTRIBUTION_MATCH_FIELDS = [
  "ad_id",
  "adset_id",
  "campaign_id",
  "utm_campaign",
  "utm_content",
  "utm_source",
  "utm_term",
] as const;

export type AttributionMatchField = (typeof ATTRIBUTION_MATCH_FIELDS)[number];

export const AD_PLATFORMS = ["META", "GOOGLE", "TIKTOK", "OTHER"] as const;
export type AdPlatform = (typeof AD_PLATFORMS)[number];

export const attributionTouchSchema = z.object({
  ad_id: z.string().optional(),
  adset_id: z.string().optional(),
  campaign_id: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_content: z.string().optional(),
  utm_term: z.string().optional(),
  gclid: z.string().optional(),
  fbclid: z.string().optional(),
  ttclid: z.string().optional(),
  referrer: z.string().optional(),
  landingPath: z.string().optional(),
  capturedAt: z.string().optional(),
});

export type AttributionTouch = z.infer<typeof attributionTouchSchema>;

export const VISITOR_EVENT_TYPES = [
  "landing",
  "view_product",
  "view_category",
  "search",
  "add_to_cart",
  "remove_from_cart",
  "begin_checkout",
  "purchase",
  "wishlist",
  "block_impression",
  "block_click",
] as const;

export type VisitorEventType = (typeof VISITOR_EVENT_TYPES)[number];

export const visitorEventPayloadSchema = z.object({
  visitorId: z.string().min(1).max(128).optional(),
  consent: z.boolean().optional(),
  type: z.enum(VISITOR_EVENT_TYPES),
  productId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  value: z.string().max(500).optional(),
  url: z.string().max(2000).optional(),
  referrer: z.string().max(2000).optional(),
  deviceType: z.string().max(64).optional(),
  city: z.string().max(120).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type VisitorEventPayload = z.infer<typeof visitorEventPayloadSchema>;

export const SEGMENT_RULE_FIELDS = [
  "ad_id",
  "campaign_id",
  "utm_campaign",
  "utm_source",
  "device_type",
  "city",
  "viewed_category",
  "min_orders",
  "total_spent_min",
  "abandoned_cart",
  "first_visit",
  "customer_group",
] as const;

export type SegmentRuleField = (typeof SEGMENT_RULE_FIELDS)[number];

export const SEGMENT_RULE_OPERATORS = [
  "eq",
  "neq",
  "contains",
  "in",
  "gte",
  "lte",
  "is_true",
  "is_false",
] as const;

export type SegmentRuleOperator = (typeof SEGMENT_RULE_OPERATORS)[number];

export const segmentConditionSchema = z.object({
  field: z.enum(SEGMENT_RULE_FIELDS),
  operator: z.enum(SEGMENT_RULE_OPERATORS).optional(),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
});

export type SegmentCondition = z.infer<typeof segmentConditionSchema>;

export interface SegmentRuleGroup {
  match: "ALL" | "ANY";
  conditions?: SegmentCondition[];
  rules?: SegmentCondition[];
  groups?: SegmentRuleGroup[];
}

export const segmentRuleGroupSchema: z.ZodType<SegmentRuleGroup> = z.lazy(() =>
  z.object({
    match: z.enum(["ALL", "ANY"]).default("ALL"),
    conditions: z.array(segmentConditionSchema).optional(),
    rules: z.array(segmentConditionSchema).optional(),
    groups: z.array(segmentRuleGroupSchema).optional(),
  })
);

export const segmentInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Segment adı zorunludur"),
  description: z.string().optional(),
  priority: z.number().int().min(-1000).max(10000).default(0),
  isActive: z.boolean().default(true),
  rules: segmentRuleGroupSchema,
});

export type SegmentInput = z.infer<typeof segmentInputSchema>;

export const adMappingInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Eşleştirme adı zorunludur"),
  platform: z.enum(AD_PLATFORMS).default("META"),
  matchField: z.enum(ATTRIBUTION_MATCH_FIELDS),
  matchValue: z.string().min(1, "Eşleşme değeri zorunludur"),
  segmentId: z.string().nullable().optional(),
  featuredProductIds: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export type AdMappingInput = z.infer<typeof adMappingInputSchema>;

export const MERCH_SCOPES = ["HOME", "CATEGORY", "SEARCH", "ALL"] as const;
export type MerchScope = (typeof MERCH_SCOPES)[number];

export const MERCH_ACTIONS = ["PIN", "BOOST", "BURY", "HIDE"] as const;
export type MerchAction = (typeof MERCH_ACTIONS)[number];

export const merchRuleInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Kural adı zorunludur"),
  segmentId: z.string().nullable().optional(),
  scope: z.enum(MERCH_SCOPES).default("ALL"),
  categoryId: z.string().nullable().optional(),
  searchTerm: z.string().nullable().optional(),
  action: z.enum(MERCH_ACTIONS),
  productIds: z.array(z.string()).min(1, "En az bir ürün seçilmelidir"),
  weight: z.number().min(0.1).max(100).default(1.5),
  priority: z.number().int().min(-1000).max(10000).default(0),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

export type MerchRuleInput = z.infer<typeof merchRuleInputSchema>;

export const EXPERIMENT_GOALS = ["block_click", "add_to_cart", "purchase"] as const;
export type ExperimentGoal = (typeof EXPERIMENT_GOALS)[number];

export const EXPERIMENT_STATUSES = ["DRAFT", "RUNNING", "PAUSED", "COMPLETED"] as const;
export type ExperimentStatusType = (typeof EXPERIMENT_STATUSES)[number];

export const experimentInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Test adı zorunludur"),
  blockId: z.string().min(1, "Ana sayfa bloğu seçilmelidir"),
  goal: z.enum(EXPERIMENT_GOALS).default("purchase"),
  status: z.enum(EXPERIMENT_STATUSES).default("RUNNING"),
});

export type ExperimentInput = z.infer<typeof experimentInputSchema>;
