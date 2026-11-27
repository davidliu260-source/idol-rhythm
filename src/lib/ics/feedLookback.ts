/**
 * ICS 行事曆（單一偶像、我追蹤的全部偶像）會保留「最近 30 天內結束」的活動，
 * 所以讀庫時要往前多看 31 天（30 天截止日 + 1 天緩衝）。
 * getPublishedEvents 預設只往前看 1 天（Must #12 日期下限），ICS 不能用預設值。
 */
export const ICS_FEED_LOOKBACK_DAYS = 31
