import { feeModel } from '../models/feeModel';
import { orgFeeModel } from '../models/orgFeeModel';

let lastRunMonth = -1;

async function runCarryover() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-based

  // 이번 달에 이미 실행했으면 스킵
  const key = year * 100 + month;
  if (lastRunMonth === key) return;

  // 1일 0시~1시 사이에만 실행
  if (now.getDate() !== 1 || now.getHours() > 0) return;

  console.log(`[CarryoverScheduler] Running carryover for ${year}-${month}`);

  try {
    const clubIds = await feeModel.getAllClubIds();
    for (const clubId of clubIds) {
      try {
        await feeModel.ensureCarryover(clubId, year, month);
      } catch (err) {
        console.error(`[CarryoverScheduler] Failed for club ${clubId}:`, err);
      }
    }
    // 조직 이월금 처리
    try {
      const orgIds = await orgFeeModel.getAllOrgIds();
      for (const orgId of orgIds) {
        try {
          await orgFeeModel.ensureCarryover(orgId, year, month);
        } catch (err) {
          console.error(`[CarryoverScheduler] Failed for org ${orgId}:`, err);
        }
      }
      console.log(`[CarryoverScheduler] Completed for ${orgIds.length} orgs`);
    } catch (err) {
      console.error('[CarryoverScheduler] Failed to get org list:', err);
    }

    lastRunMonth = key;
    console.log(`[CarryoverScheduler] Completed for ${clubIds.length} clubs`);
  } catch (err) {
    console.error('[CarryoverScheduler] Failed to get club list:', err);
  }
}

export function startCarryoverScheduler() {
  // 서버 시작 시 즉시 한번 체크
  runCarryover().catch(() => {});

  // 매 30분마다 체크 (1일 0시를 놓치지 않도록)
  setInterval(() => {
    runCarryover().catch(() => {});
  }, 30 * 60 * 1000);

  console.log('[CarryoverScheduler] Started (checks every 30 minutes)');
}
