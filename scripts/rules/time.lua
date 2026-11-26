-- Mirrors DayNightRules::Resolve field for field; the C++ version is the fallback whenever this script is missing or errors.

local M = {}

local EPSILON = 1e-4

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

function M.sectionStart(sections, index)
	local start = 0
	for i = 1, index do
		start = start + (sections[i].duration or 0)
	end
	return start
end

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
	local nextSection = sections[((index + 1) % #sections) + 1]
	local remaining = math.max(secondsUntilNext, 0)
	local alpha = 1 - remaining / ramp
	if alpha < 0 then alpha = 0 elseif alpha > 1 then alpha = 1 end
	return own + ((nextSection.darkness or 0) - own) * alpha
end

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

-- Called by UDayNightHazardSubsystem::ArmedForSection; returns ZERO-based indices.
function M.armHazards(input)
	local armed = {}
	local hazards = input and input.hazards or {}
	for i = 1, #hazards do
		local hazard = hazards[i]
		local live = (hazard.tickInterval or 0) > 0 and (hazard.damagePerTick or 0) > 0
		local inSection = hazard.daySection == nil or hazard.daySection == input.section
		if live and inSection then
			armed[#armed + 1] = hazard.index
		end
	end
	return armed
end

function M.eligibleEvents(input)
	local ids = {}
	local events = input and input.events or {}
	for i = 1, #events do
		ids[#ids + 1] = events[i].id
	end
	return ids
end

function M.isStoreOpen(input)
	return input ~= nil and input.section == "Gameplay.DaySection.Day"
end

if tsic and tsic.rules then
	if tsic.rules.time then
		tsic.rules.time.resolve(M.resolve)
	end
	if tsic.rules.hazards then
		tsic.rules.hazards.arm(M.armHazards)
	end
	if tsic.rules.events then
		tsic.rules.events.eligible(M.eligibleEvents)
	end
	if tsic.rules.store then
		tsic.rules.store.isOpen(M.isStoreOpen)
	end
end

return M
