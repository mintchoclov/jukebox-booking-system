import { useState, useEffect, useRef } from 'react'
import API_URL from '../config'

function Card({ children, className = '' }) {
    return (
        <div className={`rounded-2xl bg-[#FFFDF8] dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-sm ${className}`}>
            {children}
        </div>
    )
}
function Button({ children, onClick, variant = 'primary', disabled = false, className = '' }) {
    const base = 'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95'
    const variants = {
        primary: 'bg-primary text-navy hover:opacity-90',
        soft: 'bg-primarySoft text-primary hover:bg-primary/20',
        ghost: 'bg-transparent text-navy/60 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/10',
        danger: 'bg-red-50 text-red-500 hover:bg-red-100',
    }
    return (
        <button className={`${base} ${variants[variant]} ${className}`} onClick={onClick} disabled={disabled}>
            {children}
        </button>
    )
}
function Badge({ children, color = 'gray' }) {
    const colors = {
        green: 'bg-green-50 text-green-600 border-green-200',
        yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
        red: 'bg-red-50 text-red-500 border-red-200',
        gray: 'bg-black/5 text-navy/50 dark:bg-white/10 dark:text-white/40 border-transparent',
    }
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[color]}`}>
            {children}
        </span>
    )
}
function SectionLabel({ children }) {
    return (
        <p className="text-xs font-semibold uppercase tracking-widest text-navy/30 dark:text-white/30 mb-3">
            {children}
        </p>
    )
}
function Spinner() {
    return (
        <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
    )
}

function fmtDate(d) {
    return new Date(d).toLocaleDateString('en-SG', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    })
}
function fmtTime(d) {
    return new Date(d).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })
}

function normTime(t) {
    return String(t || '').slice(0, 5)
}

function normDate(d) {
    if (!d) return ''
    if (d instanceof Date) {
        return d.toISOString().slice(0, 10)
    }
    return String(d).slice(0, 10)
}

function timeVal(t) {
    const [h, m] = normTime(t).split(':').map(Number)
    return h * 100 + (m || 0)
}

function slotHasStarted(slotDate, slotTime) {
    const dateStr = normDate(slotDate)
    const slotStart = new Date(`${dateStr}T${normTime(slotTime)}:00`)
    return new Date() >= slotStart
}

function UploadPanel({ bookingId, userId, type, onSuccess, submitDisabled = false, submitDisabledReason = '' }) {
    const [file, setFile] = useState(null)
    const [preview, setPreview] = useState(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')
    const [done, setDone] = useState(false)
    const [photoUrl, setPhotoUrl] = useState(null)
    const inputRef = useRef()

    function pickFile(f) {
        if (!f) return
        if (!f.type.startsWith('image/')) { setError('Only image files are allowed.'); return }
        if (f.size > 5 * 1024 * 1024) { setError('File must be under 5 MB.'); return }
        setError('')
        setFile(f)
        setPreview(URL.createObjectURL(f))
    }
    function handleChange(e) { pickFile(e.target.files[0]) }
    function handleDrop(e) { e.preventDefault(); pickFile(e.dataTransfer.files[0]) }

    async function handleSubmit() {
        if (!file) return
        setUploading(true)
        setError('')
        const formData = new FormData()
        formData.append('photo', file)
        formData.append('user_id', userId)
        formData.append('booking_id', bookingId)

        const route = type === 'band'
            ? `${API_URL}/api/band/upload-humidifier-photo`
            : `${API_URL}/api/individual/upload-humidifier-photo`

        try {
            const res = await fetch(route, { method: 'POST', body: formData })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || 'Upload failed.')
            setDone(true)
            setPhotoUrl(data.humidifier_photo_url)
            onSuccess?.()
        } catch (err) {
            setError(err.message)
        } finally {
            setUploading(false)
        }
    }

    function reset() {
        setFile(null); setPreview(null); setError('')
        setDone(false); setPhotoUrl(null)
        if (inputRef.current) inputRef.current.value = ''
    }

    if (done) return (
        <div className="flex flex-col items-center gap-4 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-2xl">✅</div>
            <div>
                <p className="font-semibold text-navy dark:text-white text-sm">Photo submitted!</p>
                <p className="text-xs text-navy/50 dark:text-white/40 mt-0.5">Thanks for checking the humidifier 🎸</p>
            </div>
            {photoUrl && (
                <img
                    src={`${API_URL}${photoUrl}`}
                    alt="Uploaded humidifier photo"
                    className="w-full max-w-xs rounded-xl border border-black/10 dark:border-white/10 object-cover"
                />
            )}
            <Button variant="ghost" onClick={reset} className="text-xs">Upload a different photo</Button>
        </div>
    )

    return (
        <div className="flex flex-col gap-4">
            <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => inputRef.current?.click()}
                className="relative border-2 border-dashed border-primary/30 dark:border-primary/20 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/60 transition-colors min-h-[160px] bg-primarySoft/30 dark:bg-white/[0.03]"
            >
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
                {preview
                    ? <img src={preview} alt="Preview" className="w-full max-h-40 object-contain rounded-lg" />
                    : <>
                        <span className="text-3xl">📷</span>
                        <p className="text-xs text-navy/50 dark:text-white/40 text-center">
                            Drag a photo here, or <span className="text-primary font-medium">browse</span>
                        </p>
                        <p className="text-xs text-navy/30 dark:text-white/30">JPG · PNG · WEBP · Max 5 MB</p>
                    </>
                }
            </div>
            {preview && (
                <div className="flex items-center justify-between text-xs">
                    <span className="text-navy/60 dark:text-white/50 truncate max-w-[200px]">{file?.name}</span>
                    <button onClick={reset} className="text-navy/40 dark:text-white/30 hover:text-red-400 transition-colors">Remove</button>
                </div>
            )}
            {error && <p className="text-xs text-red-500">{error}</p>}
            {submitDisabled && (
                <p className="text-xs text-navy/40 dark:text-white/30">⏰ {submitDisabledReason}</p>
            )}
            <Button onClick={handleSubmit} disabled={!file || uploading || submitDisabled} className="self-start">
                {uploading ? <><Spinner /> Uploading…</> : 'Submit photo'}
            </Button>
        </div>
    )
}

function IndividualHumidifier({ userId }) {
    const [myBookings, setMyBookings] = useState([])
    const [allBookings, setAllBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [editing, setEditing] = useState({})

    useEffect(() => {
        Promise.all([
            fetch(`${API_URL}/api/individual/view-my-bookings?user_id=${userId}`).then(r => r.json()),
            fetch(`${API_URL}/api/admin/bookings`).then(r => r.json()),
        ])
            .then(([mine, all]) => {
                setMyBookings(Array.isArray(mine) ? mine : [])
                setAllBookings(Array.isArray(all) ? all : [])
                setLoading(false)
            })
            .catch(() => { setError('Failed to load bookings.'); setLoading(false) })
    }, [userId])

    function getLastSlotBookings() {
        const latestByDate = {}
        allBookings.forEach(b => {
            if (b.status !== 'confirmed') return
            const date = normDate(b.slot_date)
            const tv = timeVal(b.slot_time)
            if (!latestByDate[date] || tv > latestByDate[date]) {
                latestByDate[date] = tv
            }
        })

        return myBookings.filter(b => {
            if (b.status !== 'confirmed') return false
            const date = normDate(b.slot_date)
            return timeVal(b.slot_time) === latestByDate[date]
        })
    }

    const lastSlots = getLastSlotBookings()
    const needsPhoto = lastSlots.filter(b => !b.humidifier_photo_url)
    const doneSlots = lastSlots.filter(b => b.humidifier_photo_url)

    function slotLabel(t) {
        const hhmm = normTime(t)
        const [h] = hhmm.split(':').map(Number)
        const end = `${(h + 2) % 24}:00`.padStart(5, '0')
        return `${hhmm} – ${end}`
    }

    if (loading) return (
        <div className="flex items-center gap-2 py-8 text-navy/40 dark:text-white/30 text-sm justify-center">
            <Spinner /> Loading…
        </div>
    )
    if (error) return <p className="text-sm text-red-500 py-4">{error}</p>

    if (lastSlots.length === 0) return (
        <Card className="p-8 text-center">
            <p className="text-3xl mb-3">🔒</p>
            <p className="font-semibold text-navy dark:text-white text-sm">Nothing to do here</p>
            <p className="text-xs text-navy/50 dark:text-white/40 mt-1">
                This tab is only active when you have the last booking of the day.
            </p>
        </Card>
    )

    return (
        <div className="flex flex-col gap-5">
            {needsPhoto.length > 0 && (
                <div>
                    <SectionLabel>Upload needed</SectionLabel>
                    {needsPhoto.map(b => (
                        <Card key={b.id} className="p-5 mb-3">
                            <div className="mb-4">
                                <p className="font-semibold text-navy dark:text-white text-sm">{fmtDate(normDate(b.slot_date) + 'T12:00:00')}</p>
                                <p className="text-xs text-navy/50 dark:text-white/40">{slotLabel(b.slot_time)} · last booking of the day</p>
                                <p className="text-xs text-navy/40 dark:text-white/30 mt-1">
                                    You have the last slot today. Please take a photo of the humidifier before leaving.
                                </p>
                            </div>
                            <UploadPanel
                                bookingId={b.id}
                                userId={userId}
                                type="individual"
                                submitDisabled={!slotHasStarted(b.slot_date, b.slot_time)}
                                submitDisabledReason={`Submission opens at ${normTime(b.slot_time)}`}
                                onSuccess={() => setMyBookings(prev =>
                                    prev.map(x => x.id === b.id ? { ...x, humidifier_photo_url: 'pending' } : x)
                                )}
                            />
                        </Card>
                    ))}
                </div>
            )}

            {doneSlots.length > 0 && (
                <div>
                    <SectionLabel>Already submitted</SectionLabel>
                    {doneSlots.map(b => (
                        <Card key={b.id} className="p-4 mb-2">
                            <div className="flex items-center gap-3">
                                <a href={`${API_URL}${b.humidifier_photo_url}`} target="_blank" rel="noreferrer">
                                    <img
                                        src={`${API_URL}${b.humidifier_photo_url}`}
                                        alt="Humidifier"
                                        className="w-16 h-16 rounded-xl object-cover border border-black/10 dark:border-white/10 shrink-0 hover:opacity-80 transition-opacity"
                                    />
                                </a>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-navy dark:text-white">{fmtDate(normDate(b.slot_date) + 'T12:00:00')}</p>
                                    <p className="text-xs text-navy/40 dark:text-white/30">{slotLabel(b.slot_time)}</p>
                                    {b.humidifier_photo_uploaded_at && (
                                        <p className="text-xs text-navy/30 dark:text-white/30 mt-0.5">
                                            Uploaded {fmtTime(b.humidifier_photo_uploaded_at)}
                                        </p>
                                    )}
                                    <Badge color="green" className="mt-1">✓ Done</Badge>
                                </div>
                            </div>

                            {b.humidifier_flagged === 1 && (
                                <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-200">
                                    <p className="text-xs text-red-500 font-medium">⚠️ Admin flagged this photo as incorrect. Please replace it.</p>
                                </div>
                            )}

                            <div className="flex gap-2 mt-3">
                                <Button
                                    variant="soft"
                                    className="text-xs px-3 py-1.5"
                                    onClick={() => setEditing(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
                                >
                                    {editing[b.id] ? '↩️ Undo' : '✏️ Replace'}
                                </Button>
                                <Button
                                    variant="danger"
                                    className="text-xs px-3 py-1.5"
                                    onClick={async () => {
                                        if (!window.confirm('Delete this submission?')) return
                                        await fetch(`${API_URL}/api/individual/delete-humidifier-photo`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ user_id: userId, booking_id: b.id })
                                        })
                                        setMyBookings(prev =>
                                            prev.map(x => x.id === b.id
                                                ? { ...x, humidifier_photo_url: null, humidifier_photo_uploaded_at: null }
                                                : x
                                            )
                                        )
                                    }}
                                >
                                    🗑️ Delete
                                </Button>
                            </div>
                            {editing[b.id] && (
                                <div className="mt-3 border-t border-black/5 dark:border-white/10 pt-3">
                                    <UploadPanel
                                        bookingId={b.id}
                                        userId={userId}
                                        type="individual"
                                        submitDisabled={!slotHasStarted(b.slot_date, b.slot_time)}
                                        submitDisabledReason={`Submission opens at ${normTime(b.slot_time)}`}
                                        onSuccess={() => {
                                            setEditing(prev => ({ ...prev, [b.id]: false }))
                                            setMyBookings(prev =>
                                                prev.map(x => x.id === b.id ? { ...x, humidifier_photo_url: 'pending' } : x)
                                            )
                                        }}
                                    />
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}

function BandHumidifier({ userId, myBands }) {
    const [myBandBookings, setMyBandBookings] = useState([])
    const [allBookings, setAllBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [editing, setEditing] = useState({})

    useEffect(() => {
        Promise.all([
            fetch(`${API_URL}/api/band/my-bookings?user_id=${userId}`).then(r => r.json()),
            fetch(`${API_URL}/api/admin/bookings`).then(r => r.json()),
        ])
            .then(([mine, all]) => {
                setMyBandBookings(Array.isArray(mine) ? mine : [])
                setAllBookings(Array.isArray(all) ? all : [])
                setLoading(false)
            })
            .catch(() => { setError('Failed to load bookings.'); setLoading(false) })
    }, [userId])

    function latestByDate() {
        const map = {}
        allBookings.forEach(b => {
            if (b.status !== 'confirmed') return
            const date = normDate(b.slot_date)
            const tv = timeVal(b.slot_time)
            if (!map[date] || tv > map[date]) map[date] = tv
        })
        return map
    }

    function getLastSlotBandBookings() {
        const lbd = latestByDate()
        return myBandBookings.filter(b => {
            if (b.status !== 'confirmed') return false
            const date = normDate(b.slot_date)
            return timeVal(b.slot_time) === lbd[date]
        })
    }

    function markUploaded() {
        fetch(`${API_URL}/api/band/my-bookings?user_id=${userId}`)
            .then(r => r.json())
            .then(data => setMyBandBookings(Array.isArray(data) ? data : []))
            .catch(() => { })
    }

    function slotLabel(t) {
        const hhmm = normTime(t)
        const [h] = hhmm.split(':').map(Number)
        const end = `${(h + 2) % 24}:00`.padStart(5, '0')
        return `${hhmm} – ${end}`
    }

    if (loading) return (
        <div className="flex items-center gap-2 py-8 text-navy/40 dark:text-white/30 text-sm justify-center">
            <Spinner /> Loading…
        </div>
    )
    if (error) return <p className="text-sm text-red-500 py-4">{error}</p>

    const lastSlots = getLastSlotBandBookings()

    if (lastSlots.length === 0) return (
        <Card className="p-8 text-center">
            <p className="text-3xl mb-3">🔒</p>
            <p className="font-semibold text-navy dark:text-white text-sm">Nothing to do here</p>
            <p className="text-xs text-navy/50 dark:text-white/40 mt-1">
                This shows when your band has the last booking of the day.
            </p>
        </Card>
    )

    const byBand = {}
    lastSlots.forEach(b => {
        if (!byBand[b.band_id]) byBand[b.band_id] = []
        byBand[b.band_id].push(b)
    })

    return (
        <div className="flex flex-col gap-5">
            {Object.keys(byBand).map(bandId => {
                const slots = byBand[bandId]
                const band = myBands.find(b => String(b.band_id) === String(bandId))
                const pending = slots.filter(b => !b.humidifier_photo_url)
                const done = slots.filter(b => b.humidifier_photo_url)

                return (
                    <div key={bandId}>
                        {myBands.length > 1 && <SectionLabel>{band?.band_name || `Band #${bandId}`}</SectionLabel>}

                        {pending.map(b => (
                            <Card key={b.booking_id} className="p-5 mb-3">
                                <div className="mb-4">
                                    <p className="font-semibold text-navy dark:text-white text-sm">
                                        {fmtDate(normDate(b.slot_date) + 'T12:00:00')}
                                    </p>
                                    <p className="text-xs text-navy/50 dark:text-white/40">{slotLabel(b.slot_time)} · last booking of the day</p>
                                    <p className="text-xs text-navy/40 dark:text-white/30 mt-1">
                                        Your band has the last slot today. Anyone in the band can submit this photo.
                                    </p>
                                </div>
                                <UploadPanel
                                    bookingId={b.booking_id}
                                    userId={userId}
                                    type="band"
                                    submitDisabled={!slotHasStarted(b.slot_date, b.slot_time)}
                                    submitDisabledReason={`Submission opens at ${normTime(b.slot_time)}`}
                                    onSuccess={() => markUploaded()}
                                />
                            </Card>
                        ))}

                        {done.map(b => (
                            <Card key={b.booking_id} className="p-4 mb-2">
                                <div className="flex items-center gap-3">
                                    <a href={`${API_URL}${b.humidifier_photo_url}`} target="_blank" rel="noreferrer">
                                        <img
                                            src={`${API_URL}${b.humidifier_photo_url}`}
                                            alt="Humidifier"
                                            className="w-16 h-16 rounded-xl object-cover border border-black/10 dark:border-white/10 shrink-0 hover:opacity-80 transition-opacity"
                                        />
                                    </a>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-navy dark:text-white">
                                            {fmtDate(normDate(b.slot_date) + 'T12:00:00')}
                                        </p>
                                        <p className="text-xs text-navy/40 dark:text-white/30">{slotLabel(b.slot_time)}</p>
                                        {b.humidifier_photo_uploaded_at && (
                                            <p className="text-xs text-navy/30 dark:text-white/30 mt-0.5">
                                                Uploaded {fmtTime(b.humidifier_photo_uploaded_at)}
                                            </p>
                                        )}
                                        <Badge color="green" className="mt-1">✓ Done</Badge>
                                    </div>
                                </div>

                                {b.humidifier_flagged === 1 && (
                                    <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-200">
                                        <p className="text-xs text-red-500 font-medium">⚠️ Admin flagged this photo as incorrect. Please replace it.</p>
                                    </div>
                                )}

                                <div className="flex gap-2 mt-3">
                                    <Button
                                        variant="soft"
                                        className="text-xs px-3 py-1.5"
                                        onClick={() => setEditing(prev => ({ ...prev, [b.booking_id]: !prev[b.booking_id] }))}
                                    >
                                        {editing[b.booking_id] ? '↩️ Undo' : '✏️ Replace'}
                                    </Button>
                                    <Button
                                        variant="danger"
                                        className="text-xs px-3 py-1.5"
                                        onClick={async () => {
                                            if (!window.confirm('Delete this submission?')) return
                                            await fetch(`${API_URL}/api/band/delete-humidifier-photo`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ user_id: userId, booking_id: b.booking_id })
                                            })
                                            setMyBandBookings(prev =>
                                                prev.map(x => x.booking_id === b.booking_id
                                                    ? { ...x, humidifier_photo_url: null, humidifier_photo_uploaded_at: null }
                                                    : x
                                                )
                                            )
                                        }}
                                    >
                                        🗑️ Delete
                                    </Button>
                                </div>
                                {editing[b.booking_id] && (
                                    <div className="mt-3 border-t border-black/5 dark:border-white/10 pt-3">
                                        <UploadPanel
                                            bookingId={b.booking_id}
                                            userId={userId}
                                            type="band"
                                            submitDisabled={!slotHasStarted(b.slot_date, b.slot_time)}
                                            submitDisabledReason={`Submission opens at ${normTime(b.slot_time)}`}
                                            onSuccess={() => {
                                                setEditing(prev => ({ ...prev, [b.booking_id]: false }))
                                                setMyBandBookings(prev =>
                                                    prev.map(x => x.booking_id === b.booking_id
                                                        ? { ...x, humidifier_photo_url: 'pending' }
                                                        : x
                                                    )
                                                )
                                            }}
                                        />
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                )
            })}
        </div>
    )
}

function AdminHumidifier({ userId }) {
    const [allBookings, setAllBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [reminding, setReminding] = useState({})
    const [reminded, setReminded] = useState({})

    useEffect(() => { fetchAll() }, [])

    function fetchAll() {
        setLoading(true)
        fetch(`${API_URL}/api/admin/bookings`)
            .then(r => r.json())
            .then(data => {
                setAllBookings(Array.isArray(data) ? data : [])
                setLoading(false)
            })
            .catch(() => { setError('Failed to load submissions.'); setLoading(false) })
    }

    function getLastSlotBookings() {
        const confirmed = allBookings.filter(b => b.status === 'confirmed')

        const latestByDate = {}
        confirmed.forEach(b => {
            const date = normDate(b.slot_date)
            const tv = timeVal(b.slot_time)
            if (!latestByDate[date] || tv > latestByDate[date]) latestByDate[date] = tv
        })

        return confirmed.filter(b => {
            const date = normDate(b.slot_date)
            return timeVal(b.slot_time) === latestByDate[date]
        })
    }

    async function sendReminder(bookingId, label) {
        setReminding(r => ({ ...r, [bookingId]: true }))
        try {
            const res = await fetch(`${API_URL}/api/admin/remind`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ booking_id: bookingId, admin_user_id: userId, reason: label })
            })
            if (!res.ok) throw new Error()
            setReminded(r => ({ ...r, [bookingId]: label }))
            if (label === 'flag') {
                setTimeout(() => {
                    setReminded(r => ({ ...r, [bookingId]: null }))
                }, 3000)
            }
        } catch {
            alert('Failed to send reminder. (Check /api/admin/remind is wired up.)')
        } finally {
            setReminding(r => ({ ...r, [bookingId]: false }))
        }
    }

    function slotLabel(t) {
        const hhmm = normTime(t)
        const [h] = hhmm.split(':').map(Number)
        const end = `${(h + 2) % 24}:00`.padStart(5, '0')
        return `${hhmm} – ${end}`
    }

    if (loading) return (
        <div className="flex items-center gap-2 py-8 text-navy/40 dark:text-white/30 text-sm justify-center">
            <Spinner /> Loading submissions…
        </div>
    )
    if (error) return <p className="text-sm text-red-500 py-4">{error}</p>

    const lastSlots = getLastSlotBookings()

    const byDate = {}
    lastSlots.forEach(b => {
        const date = normDate(b.slot_date)
        if (!byDate[date]) byDate[date] = []
        byDate[date].push(b)
    })
    const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

    if (dates.length === 0) return (
        <Card className="p-8 text-center">
            <p className="text-3xl mb-3">💧</p>
            <p className="text-navy/50 dark:text-white/40 text-sm">No confirmed bookings yet.</p>
        </Card>
    )

    return (
        <div className="flex flex-col gap-6">
            {dates.map(date => (
                <div key={date}>
                    <SectionLabel>{fmtDate(date + 'T12:00:00')}</SectionLabel>
                    <div className="flex flex-col gap-3">
                        {byDate[date].map(b => {
                            const hasPhoto = !!b.humidifier_photo_url
                            const key = b.id
                            return (
                                <Card key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-4">

                                    {/* photo or placeholder */}
                                    <div className="shrink-0">
                                        {hasPhoto ? (
                                            <a href={`${API_URL}${b.humidifier_photo_url}`} target="_blank" rel="noreferrer">
                                                <img
                                                    src={`${API_URL}${b.humidifier_photo_url}`}
                                                    alt="Humidifier"
                                                    className="w-20 h-20 rounded-xl object-cover border border-black/10 dark:border-white/10 hover:opacity-80 transition-opacity"
                                                />
                                            </a>
                                        ) : (
                                            <div className="w-20 h-20 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-2xl border-2 border-dashed border-black/10 dark:border-white/10">
                                                📷
                                            </div>
                                        )}
                                    </div>

                                    {/* info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <span className="font-medium text-sm text-navy dark:text-white">
                                                {b.band_name || b.booked_by || 'Unknown'}
                                            </span>
                                            <span className="text-xs text-navy/40 dark:text-white/30">
                                                {b.booking_type === 'band' ? '🎸 Band' : '🎵 Individual'}
                                            </span>
                                            {hasPhoto
                                                ? <Badge color="green">✓ Submitted</Badge>
                                                : <Badge color="yellow">⏳ Pending</Badge>
                                            }
                                        </div>
                                        <p className="text-xs text-navy/40 dark:text-white/30">
                                            Last slot · {slotLabel(b.slot_time)}
                                        </p>
                                        {b.humidifier_photo_uploaded_at && (
                                            <p className="text-xs text-navy/30 dark:text-white/30 mt-0.5">
                                                Uploaded {fmtTime(b.humidifier_photo_uploaded_at)}
                                            </p>
                                        )}
                                        {(b.humidifier_flagged === 1 || reminded[key] === 'flag') && (
                                            <p className="text-xs text-yellow-600 mt-1">⚠️ Flagged as wrong photo</p>
                                        )}
                                        {reminded[key] === 'remind' && (
                                            <p className="text-xs text-primary mt-1">🔔 Reminder sent</p>
                                        )}
                                    </div>

                                    {/* actions */}
                                    <div className="flex flex-col gap-2 shrink-0">
                                        {!hasPhoto && (
                                            <Button
                                                variant="soft"
                                                disabled={!!reminding[key] || reminded[key] === 'remind'}
                                                onClick={() => sendReminder(key, 'remind')}
                                                className="text-xs px-3 py-1.5"
                                            >
                                                {reminding[key]
                                                    ? <><Spinner /> Sending…</>
                                                    : reminded[key] === 'remind' ? '✓ Reminded' : '🔔 Remind'}
                                            </Button>
                                        )}
                                        {hasPhoto && (
                                            <Button
                                                variant="danger"
                                                disabled={!!reminding[key]}
                                                onClick={() => sendReminder(key, 'flag')}
                                                className="text-xs px-3 py-1.5"
                                            >
                                                {reminding[key]
                                                    ? <><Spinner /> Sending…</>
                                                    : reminded[key] === 'flag' ? '✓ Flagged' : '⚠️ Wrong photo?'}
                                            </Button>
                                        )}
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            ))}
        </div>
    )
}

export function useShowHumidifierTab(userId, userRole) {
    const [show, setShow] = useState(userRole === 'admin') 

    useEffect(() => {
        if (userRole === 'admin') return 

        const myEndpoint = userRole === 'band'
            ? `${API_URL}/api/band/my-bookings?user_id=${userId}`
            : `${API_URL}/api/individual/view-my-bookings?user_id=${userId}`

        Promise.all([
            fetch(myEndpoint).then(r => r.json()),
            fetch(`${API_URL}/api/admin/bookings`).then(r => r.json()),
        ])
            .then(([mine, all]) => {
                if (!Array.isArray(mine) || !Array.isArray(all)) return

                const latestByDate = {}
                all.forEach(b => {
                    if (b.status !== 'confirmed') return
                    const date = normDate(b.slot_date)
                    const tv = timeVal(b.slot_time)
                    if (!latestByDate[date] || tv > latestByDate[date]) latestByDate[date] = tv
                })

                const today = normDate(new Date())

                const isLastUser = mine.some(b => {
                    if (b.status !== 'confirmed') return false
                    const date = normDate(b.slot_date)
                    if (date !== today) return false 
                    return timeVal(b.slot_time) === latestByDate[today]  
                })

                setShow(isLastUser)
            })
            .catch(() => setShow(false))
    }, [userId, userRole])

    return show
}

export default function HumidifierTab({ userId, userRole, myBands = [] }) {
    if (userRole === 'admin') return (
        <div className="flex flex-col gap-4">
            <div>
                <h2 className="text-base font-semibold text-navy dark:text-white">Humidifier submissions</h2>
                <p className="text-xs text-navy/50 dark:text-white/40 mt-0.5">
                    All end-of-day humidifier check photos, grouped by date.
                </p>
            </div>
            <IndividualHumidifier userId={userId} />
            <AdminHumidifier userId={userId} />
        </div>
    )

    if (userRole === 'band') return (
        <div className="flex flex-col gap-4">
            <div>
                <h2 className="text-base font-semibold text-navy dark:text-white">Humidifier check</h2>
                <p className="text-xs text-navy/50 dark:text-white/40 mt-0.5">
                    Required when your band has the last booking of the day. Anyone in the band can submit.
                </p>
            </div>
            <BandHumidifier userId={userId} myBands={myBands} />
        </div>
    )

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h2 className="text-base font-semibold text-navy dark:text-white">Humidifier check</h2>
                <p className="text-xs text-navy/50 dark:text-white/40 mt-0.5">
                    Required when you have the last self-practice slot of the day.
                </p>
            </div>
            <IndividualHumidifier userId={userId} />
        </div>
    )
}