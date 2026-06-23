function formatLocalDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function parseMysqlDateOnly(dateValue) {
    if (dateValue instanceof Date) {
        return new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate())
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

function allocateSlots(bids, options = {}) {
    const MAX_SLOTS_PER_BAND_PER_WEEK = options.maxSlotsPerBand ?? 2

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
        slots[slotKey].all_bids.push({ ...bid, slot_date: slotDate })
    })

    const sortedSlots = Object.values(slots).sort((a, b) => {
        if (a.slot_date !== b.slot_date) return a.slot_date.localeCompare(b.slot_date)
        return String(a.slot_time).localeCompare(String(b.slot_time))
    })

    const bandWeeklyWinCount = {}
    const response = []

    sortedSlots.forEach((slot) => {
        const candidates = [...slot.all_bids].sort((a, b) => {
            if (b.effective_bid_value !== a.effective_bid_value) {
                return b.effective_bid_value - a.effective_bid_value
            }
            if (a.preference_rank !== b.preference_rank) {
                return a.preference_rank - b.preference_rank
            }
            return 0
        })

        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            const sameScore = candidates[i].effective_bid_value === candidates[j].effective_bid_value
            const sameRank = candidates[i].preference_rank === candidates[j].preference_rank
            if (sameScore && sameRank) {
                const temp = candidates[i]
                candidates[i] = candidates[j]
                candidates[j] = temp
            }
        }

        const maxScore = Math.max(...slot.all_bids.map((bid) => bid.effective_bid_value))
        const tieCandidates = slot.all_bids.filter((bid) => bid.effective_bid_value === maxScore)

        let winner = null
        let skippedBecauseMaxSlots = []

        for (const candidate of candidates) {
            const countKey = `${slot.week_monday}_${candidate.band_id}`
            const currentWins = bandWeeklyWinCount[countKey] || 0
            if (currentWins < MAX_SLOTS_PER_BAND_PER_WEEK) {
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

        if (!winner) {
            response.push({
                slot_date: slot.slot_date,
                slot_time: slot.slot_time,
                week_monday: slot.week_monday,
                status: 'unallocated',
                message: 'No eligible band available because ALL candidates reached max 2 slots for this week.',
                all_bids: slot.all_bids.map((bid) => ({
                    band_id: bid.band_id,
                    band_name: bid.band_name,
                    preference_rank: bid.preference_rank,
                    score: bid.effective_bid_value
                })),
                skipped_bands: skippedBecauseMaxSlots
            })
            return
        }

        const winnerCountKey = `${slot.week_monday}_${winner.band_id}`
        response.push({
            slot_date: slot.slot_date,
            slot_time: slot.slot_time,
            week_monday: slot.week_monday,
            status: 'suggested',
            is_tie: tieCandidates.length > 1,
            winner_band_id: winner.band_id,
            suggested_winner: winner.band_name,
            winner_score: winner.effective_bid_value,
            winner_preference_rank: winner.preference_rank,
            band_weekly_win_count: bandWeeklyWinCount[winnerCountKey],
            tie_candidates: tieCandidates.map((bid) => ({
                band_id: bid.band_id,
                band_name: bid.band_name,
                preference_rank: bid.preference_rank,
                score: bid.effective_bid_value
            })),
            skipped_bands: skippedBecauseMaxSlots
        })
    })

    return response
}

module.exports = { allocateSlots, getWeekMondayString, toDateString }