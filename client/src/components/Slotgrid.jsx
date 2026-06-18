import React from 'react'

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const times = ['8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm', '10pm']

function SlotGrid({ weekDates, getSlotStyle, getSlotLabel, onSlotClick, selectedSlot }) {
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: '420px' }}>
        <div className="grid gap-1" style={{ gridTemplateColumns: '36px repeat(7, 1fr)' }}>
          <div></div>
          {weekDates.map((d, i) => (
            <div key={i} className="text-center pb-1">
              <p className="text-navy opacity-50" style={{ fontSize: '9px', fontWeight: 500 }}>{days[i]}</p>
              <p className="text-navy opacity-30" style={{ fontSize: '8px' }}>{d.getDate()}</p>
            </div>
          ))}
          {times.map((time, ti) => (
            <React.Fragment key={ti}>
              <div className="flex items-center justify-end pr-1">
                <span className="text-navy opacity-40" style={{ fontSize: '8px' }}>{time}</span>
              </div>
              {weekDates.map((date, di) => {
                const style = getSlotStyle(di, ti, date)
                const label = getSlotLabel(di, ti, date)
                const lines = label.split('\n')
                const isSelected = selectedSlot?.d === di && selectedSlot?.t === ti

                return (
                  <div
                    key={`${di}-${ti}`}
                    onClick={() => onSlotClick(di, ti)}
                    className={`rounded min-h-[28px] flex flex-col items-center justify-center transition-all ${style}`} style={isSelected ? { boxShadow: 'inset 0 0 0 2px #09122C', borderRadius: '4px' } : undefined}
                  >
                    {lines.map((line, li) => (
                      <span
                        key={li}
                        style={{
                          fontSize: '8px',
                          color: style.includes('bg-[#333') ? '#fff' : '#09122C',
                          lineHeight: '1.3',
                          textAlign: 'center',
                          padding: '0 1px',
                          opacity: li === 1 ? 0.6 : 0.9
                        }}
                      >
                        {line}
                      </span>
                    ))}
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SlotGrid