-- Day/night rules for the base game.
--
-- Runs in the default mod's rules VM on the listen-server host. The C++ rule host
-- (UGameWorldTimeManager) calls the function registered with tsic.rules.time.resolve
-- once per clock tick with
--
--   { timeSinceStart = <seconds since the save was created>,
--     cycle = { total = <seconds>, sections = { { id, duration, darkness, rampSeconds }, ... } } }
--
-- and expects the resolved clock back:
--
--   { day, timeInCycle, sectionIndex, secondsIntoSection, secondsUntilNext, darkness, hour24 }
--
-- The contract mirrors ScpDayNightRules::Resolve in C++ field for field, which stays the
-- fallback whenever this script is missing or errors, so the clock never stops:
--  - day is the truncation of timeSinceStart / total, so a negative pre-load clock reads as
--    day 0 with a negative timeInCycle.
--  - A section runs up to and INCLUDING its cumulative end: a clock sitting exactly on a
--    boundary still reads the earlier section. Past the last end reads the last section.
--  - sectionIndex is ZERO-based, the position in cycle.sections as authored in
--    WR_Default.json (so the section table is cycle.sections[sectionIndex + 1]); -1 means
--    an empty cycle.
--  - darkness blends from a section's own value toward the next section's (wrapping) over
--    the section's final rampSeconds. Ambience and tuning only, never a behaviour gate.
--  - hour24 = 24 * timeInCycle / total is THE hour mapping every reader takes.
--
-- Clients never run this: they read the replicated Darkness, Day, Hour24 and section tag.

local M = {}

-- Matches KINDA_SMALL_NUMBER on the C++ side.
local EPSILON = 1e-4

-- The ramp a section gets when none is authored: a quarter of the section, capped at five minutes.
function M.defaultRampSeconds(duration)
	return math.min(duration * 0.25, 300)
end

local function totalDuration(sections)
	local total = 0
	for i = 1, #sections do
		total = total + (sections[i].duration or 0)
	end
	return total
end

local function rampOf(section)
	local ramp = section.rampSeconds
	if ramp == nil or ramp <= 0 then
		return M.defaultRampSeconds(section.duration or 0)
	end
	return ramp
end

-- Seconds into the cycle at which the zero-based section `index` begins.
function M.sectionStart(sections, index)
	local start = 0
	for i = 1, index do
		start = start + (sections[i].duration or 0)
	end
	return start
end

-- Darkness for a clock that sits `secondsUntilNext` seconds before the zero-based section ends.
function M.darkness(sections, index, secondsUntilNext)
	local section = sections[index + 1]
	if section == nil then
		return 0
	end
	local duration = section.duration or 0
	local ramp = rampOf(section)
	local own = section.darkness or 0
	if duration <= EPSILON or ramp <= EPSILON then
		return own
	end
	-- Ramp across the boundary instead of stepping: with Day 0 / Night 1 this is exactly
	-- "1 - remaining / ramp" through the day and "remaining / ramp" through the night.
	local nextSection = sections[((index + 1) % #sections) + 1]
	local remaining = math.max(secondsUntilNext, 0)
	local alpha = 1 - remaining / ramp
	if alpha < 0 then alpha = 0 elseif alpha > 1 then alpha = 1 end
	return own + ((nextSection.darkness or 0) - own) * alpha
end

-- Truncation toward zero, the way C++ narrows a double to an int.
local function truncate(value)
	if value >= 0 then
		return math.floor(value)
	end
	return math.ceil(value)
end

function M.resolve(input)
	local out = {
		day = 0,
		timeInCycle = 0,
		sectionIndex = -1,
		secondsIntoSection = 0,
		secondsUntilNext = 0,
		darkness = 0,
		hour24 = 0,
	}
	local cycle = input and input.cycle or nil
	local sections = cycle and cycle.sections or nil
	if sections == nil or #sections == 0 then
		return out
	end
	local total = totalDuration(sections)
	if total <= 0 then
		return out
	end

	local clock = input.timeSinceStart or 0
	local day = truncate(clock / total)
	out.day = day
	out.timeInCycle = clock - total * day
	out.hour24 = 24 * out.timeInCycle / total

	-- First section whose cumulative end reaches the time; past the last end reads the last.
	local index = #sections - 1
	local cumulativeEnd = 0
	for i = 1, #sections do
		cumulativeEnd = cumulativeEnd + (sections[i].duration or 0)
		if cumulativeEnd >= out.timeInCycle then
			index = i - 1
			break
		end
	end
	out.sectionIndex = index

	local start = M.sectionStart(sections, index)
	out.secondsIntoSection = out.timeInCycle - start
	out.secondsUntilNext = (start + (sections[index + 1].duration or 0)) - out.timeInCycle
	out.darkness = M.darkness(sections, index, out.secondsUntilNext)
	return out
end

-- Hand the resolver to the C++ rule host. The golden test runs this file in a bare VM with
-- the same table, so registration happens here and nowhere else.
if tsic and tsic.rules and tsic.rules.time then
	tsic.rules.time.resolve(M.resolve)
end

return M
