function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseMysqlDateOnly(dateValue) {
  if (dateValue instanceof Date) {
    return new Date(
      dateValue.getFullYear(),
      dateValue.getMonth(),
      dateValue.getDate()
    )
  }

  const dateString = String(dateValue).slice(0, 10)
  const [year, month, day] = dateString.split('-').map(Number)

  return new Date(year, month - 1, day)
}

function toDateString(dateValue) {
  return formatLocalDate(parseMysqlDateOnly(dateValue))
}

function getWeekMondayString(dateValue) {
  const date = parseMysqlDateOnly(dateValue)
  const day = date.getDay()
  const daysSinceMonday = (day + 6) % 7

  date.setDate(date.getDate() - daysSinceMonday)

  return formatLocalDate(date)
}

function getAllocationLossReasonText(category) {
  const map = {
    cascading_priority: 'Lose to cascading priority',
    random_tie: 'Lose to random tie',
    low_bid_point: 'Lose to low bid point'
  }

  return map[category] || 'Lost during allocation'
}

function getAllocationLossReasonCategory(bid, winner, skippedBandIds) {
  if (skippedBandIds.has(Number(bid.band_id))) {
    return 'cascading_priority'
  }

  if (!winner) {
    return 'cascading_priority'
  }

  if (Number(bid.effective_bid_value) < Number(winner.effective_bid_value)) {
    return 'low_bid_point'
  }

  if (
    Number(bid.effective_bid_value) === Number(winner.effective_bid_value) &&
    Number(bid.preference_rank) === Number(winner.preference_rank)
  ) {
    return 'random_tie'
  }

  return 'cascading_priority'
}

function allocateWithRejectionReasons(bids, maxSlotsPerBandPerWeek = 2) {
  const slots = {}

  bids.forEach((bid) => {
    const slotDate = toDateString(bid.slot_date)
    const slotKey = `${slotDate}_${bid.slot_time}`

    if (!slots[slotKey]) {
      slots[slotKey] = {
        slot_date: slotDate,
        slot_time: bid.slot_time,
        week_monday: getWeekMondayString(bid.slot_date),
        all_bids: []
      }
    }

    slots[slotKey].all_bids.push({
      ...bid,
      slot_date: slotDate
    })
  })

  const sortedSlots = Object.values(slots).sort((a, b) => {
    if (a.slot_date !== b.slot_date) {
      return a.slot_date.localeCompare(b.slot_date)
    }

    return String(a.slot_time).localeCompare(String(b.slot_time))
  })

  const bandWeeklyWinCount = {}
  const bidResults = []

  sortedSlots.forEach((slot) => {
    const candidates = [...slot.all_bids].sort((a, b) => {
      if (b.effective_bid_value !== a.effective_bid_value) {
        return b.effective_bid_value - a.effective_bid_value
      }

      if (a.preference_rank !== b.preference_rank) {
        return a.preference_rank - b.preference_rank
      }

      // deterministic tie order for unit test
      return Number(a.bid_id) - Number(b.bid_id)
    })

    let winner = null
    const skippedBecauseMaxSlots = []

    for (const candidate of candidates) {
      const countKey = `${slot.week_monday}_${candidate.band_id}`
      const currentWins = bandWeeklyWinCount[countKey] || 0

      if (currentWins < maxSlotsPerBandPerWeek) {
        winner = candidate
        bandWeeklyWinCount[countKey] = currentWins + 1
        break
      }

      skippedBecauseMaxSlots.push({
        band_id: candidate.band_id,
        band_name: candidate.band_name,
        current_wins: currentWins,
        reason: 'Band already reached max 2 slots for this week.'
      })
    }

    const skippedBandIds = new Set(
      skippedBecauseMaxSlots.map((item) => Number(item.band_id))
    )

    slot.all_bids.forEach((bid) => {
      if (winner && Number(bid.bid_id) === Number(winner.bid_id)) {
        bidResults.push({
          bid_id: bid.bid_id,
          band_id: bid.band_id,
          band_name: bid.band_name,
          slot_date: slot.slot_date,
          slot_time: slot.slot_time,
          allocation_status: 'won',
          reject_reason_category: null,
          reject_reason: null
        })

        return
      }

      const category = getAllocationLossReasonCategory(
        bid,
        winner,
        skippedBandIds
      )

      bidResults.push({
        bid_id: bid.bid_id,
        band_id: bid.band_id,
        band_name: bid.band_name,
        slot_date: slot.slot_date,
        slot_time: slot.slot_time,
        allocation_status: 'lost',
        reject_reason_category: category,
        reject_reason: getAllocationLossReasonText(category)
      })
    })
  })

  return bidResults
}

describe('MS3 allocation rejection reasons', () => {
  test('classifies random_tie, low_bid_point, and cascading_priority correctly', () => {
    const testBids = [
      // Week 1: random tie + low bid point
      {
        bid_id: 115,
        band_id: 12,
        band_name: 'TEST_REJECT_A_STANDARD',
        slot_date: '2026-08-03',
        slot_time: '18:00:00',
        preference_rank: 1,
        effective_bid_value: 3
      },
      {
        bid_id: 116,
        band_id: 13,
        band_name: 'TEST_REJECT_B_STANDARD',
        slot_date: '2026-08-03',
        slot_time: '18:00:00',
        preference_rank: 1,
        effective_bid_value: 3
      },
      {
        bid_id: 117,
        band_id: 14,
        band_name: 'TEST_REJECT_C_LOW',
        slot_date: '2026-08-03',
        slot_time: '18:00:00',
        preference_rank: 1,
        effective_bid_value: 2
      },

      // Week 2: cascading priority by weekly max slot rule
      {
        bid_id: 118,
        band_id: 12,
        band_name: 'TEST_REJECT_A_STANDARD',
        slot_date: '2026-08-10',
        slot_time: '08:00:00',
        preference_rank: 1,
        effective_bid_value: 3
      },
      {
        bid_id: 119,
        band_id: 14,
        band_name: 'TEST_REJECT_C_LOW',
        slot_date: '2026-08-10',
        slot_time: '08:00:00',
        preference_rank: 3,
        effective_bid_value: 0
      },
      {
        bid_id: 120,
        band_id: 12,
        band_name: 'TEST_REJECT_A_STANDARD',
        slot_date: '2026-08-10',
        slot_time: '10:00:00',
        preference_rank: 1,
        effective_bid_value: 3
      },
      {
        bid_id: 121,
        band_id: 14,
        band_name: 'TEST_REJECT_C_LOW',
        slot_date: '2026-08-10',
        slot_time: '10:00:00',
        preference_rank: 3,
        effective_bid_value: 0
      },
      {
        bid_id: 122,
        band_id: 12,
        band_name: 'TEST_REJECT_A_STANDARD',
        slot_date: '2026-08-10',
        slot_time: '12:00:00',
        preference_rank: 1,
        effective_bid_value: 3
      },
      {
        bid_id: 123,
        band_id: 13,
        band_name: 'TEST_REJECT_B_STANDARD',
        slot_date: '2026-08-10',
        slot_time: '12:00:00',
        preference_rank: 2,
        effective_bid_value: 2
      }
    ]

    const results = allocateWithRejectionReasons(testBids)

    expect(results).toHaveLength(9)

    const byBidId = Object.fromEntries(
      results.map((result) => [Number(result.bid_id), result])
    )

    // Week 1:
    // A and B have same score and same rank.
    // Unit test uses deterministic ordering: A wins, B loses as random_tie case.
    expect(byBidId[115].allocation_status).toBe('won')
    expect(byBidId[115].reject_reason_category).toBeNull()
    expect(byBidId[115].reject_reason).toBeNull()

    expect(byBidId[116].allocation_status).toBe('lost')
    expect(byBidId[116].reject_reason_category).toBe('random_tie')
    expect(byBidId[116].reject_reason).toBe('Lose to random tie')

    // C loses because its bid point is lower than the winner.
    expect(byBidId[117].allocation_status).toBe('lost')
    expect(byBidId[117].reject_reason_category).toBe('low_bid_point')
    expect(byBidId[117].reject_reason).toBe('Lose to low bid point')

    // Week 2:
    // A wins 08:00 and 10:00.
    expect(byBidId[118].allocation_status).toBe('won')
    expect(byBidId[120].allocation_status).toBe('won')

    // C loses twice because of low bid point.
    expect(byBidId[119].allocation_status).toBe('lost')
    expect(byBidId[119].reject_reason_category).toBe('low_bid_point')
    expect(byBidId[119].reject_reason).toBe('Lose to low bid point')

    expect(byBidId[121].allocation_status).toBe('lost')
    expect(byBidId[121].reject_reason_category).toBe('low_bid_point')
    expect(byBidId[121].reject_reason).toBe('Lose to low bid point')

    // A has the highest score at 12:00, but already reached max 2 slots that week.
    // So A loses due to cascading priority / weekly slot limit.
    expect(byBidId[122].allocation_status).toBe('lost')
    expect(byBidId[122].reject_reason_category).toBe('cascading_priority')
    expect(byBidId[122].reject_reason).toBe('Lose to cascading priority')

    // B gets the 12:00 slot after A is skipped.
    expect(byBidId[123].allocation_status).toBe('won')
    expect(byBidId[123].reject_reason_category).toBeNull()
    expect(byBidId[123].reject_reason).toBeNull()
  })

  test('summary contains all three rejection reason categories', () => {
    const testBids = [
      {
        bid_id: 1,
        band_id: 1,
        band_name: 'A',
        slot_date: '2026-08-03',
        slot_time: '18:00:00',
        preference_rank: 1,
        effective_bid_value: 3
      },
      {
        bid_id: 2,
        band_id: 2,
        band_name: 'B',
        slot_date: '2026-08-03',
        slot_time: '18:00:00',
        preference_rank: 1,
        effective_bid_value: 3
      },
      {
        bid_id: 3,
        band_id: 3,
        band_name: 'C',
        slot_date: '2026-08-03',
        slot_time: '18:00:00',
        preference_rank: 1,
        effective_bid_value: 2
      },
      {
        bid_id: 4,
        band_id: 1,
        band_name: 'A',
        slot_date: '2026-08-10',
        slot_time: '08:00:00',
        preference_rank: 1,
        effective_bid_value: 3
      },
      {
        bid_id: 5,
        band_id: 1,
        band_name: 'A',
        slot_date: '2026-08-10',
        slot_time: '10:00:00',
        preference_rank: 1,
        effective_bid_value: 3
      },
      {
        bid_id: 6,
        band_id: 1,
        band_name: 'A',
        slot_date: '2026-08-10',
        slot_time: '12:00:00',
        preference_rank: 1,
        effective_bid_value: 3
      },
      {
        bid_id: 7,
        band_id: 2,
        band_name: 'B',
        slot_date: '2026-08-10',
        slot_time: '12:00:00',
        preference_rank: 2,
        effective_bid_value: 2
      }
    ]

    const results = allocateWithRejectionReasons(testBids)

    const lostCategories = results
      .filter((result) => result.allocation_status === 'lost')
      .map((result) => result.reject_reason_category)

    expect(lostCategories).toContain('random_tie')
    expect(lostCategories).toContain('low_bid_point')
    expect(lostCategories).toContain('cascading_priority')
  })
})