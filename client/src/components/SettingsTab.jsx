import { useState } from 'react'
import API_URL from '../config'
import { Card, Button, Badge, SectionLabel } from './UI'

const GCAL_URL = 'https://calendar.google.com/calendar/u/0/embed?src=00aff1a71fc21b9c44daa583ab89958dc986dd0cbb9a0ff20b0f5035eb2ebe60@group.calendar.google.com&ctz=Asia/Singapore'
const TELEGRAM_URL = 'https://t.me/jukebox_booking_bot'

function ToggleRow({ label, description, value, onToggle }) {
    const [localValue, setLocalValue] = useState(value)

    function handleToggle() {
        const next = !localValue
        setLocalValue(next)
        onToggle(next)
    }

    return (
        <Card className="p-4 flex justify-between items-center">
            <div>
                <p className="text-sm font-medium text-navy">{label}</p>
                <p className="text-xs text-navy opacity-50 mt-1">{description}</p>
            </div>
            <button
                onClick={handleToggle}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${localValue ? 'bg-primary' : 'bg-beige'}`}
            >
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-navy transition-transform duration-200 ${localValue ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
        </Card>
    )
}

function UsernameEdit({ user, apiEndpoint, extraBody = {}, onUsernameChange, onBandNameChange }) {
    const [editing, setEditing] = useState(false)
    const [newUsername, setNewUsername] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [currentUsername, setCurrentUsername] = useState(user.username)

    function handleSave() {
        if (!newUsername.trim() || newUsername.trim() === currentUsername) {
            setEditing(false)
            return
        }
        setLoading(true)
        setError('')
        setSuccess('')

        fetch(`${API_URL}${apiEndpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: user.id,
                username: newUsername.trim(),
                ...extraBody
            })
        })
            .then(res => res.json())
            .then(data => {
                setLoading(false)
                if (data.new_username || data.message?.toLowerCase().includes('success') || data.message?.toLowerCase().includes('already')) {
                    const updated = data.new_username || newUsername.trim()
                    setCurrentUsername(updated)
                    const stored = JSON.parse(localStorage.getItem('user') || '{}')
                    localStorage.setItem('user', JSON.stringify({ ...stored, username: updated }))
                    if (onUsernameChange) onUsernameChange(updated)
                    setSuccess(data.message || 'Username updated!')
                    setEditing(false)
                } else {
                    setError(data.message || 'Failed to update username.')
                }
            })
            .catch(() => { setLoading(false); setError('Something went wrong.') })
    }

    return (
        <Card className="p-4">
            <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium text-navy">Username</p>
                {!editing && (
                    <button
                        onClick={() => { setEditing(true); setNewUsername(currentUsername); setError(''); setSuccess('') }}
                        className="text-xs text-navy opacity-50 hover:opacity-100"
                    >Edit</button>
                )}
            </div>
            {editing ? (
                <div>
                    <p className="text-xs text-navy opacity-40 line-through mb-2">{currentUsername}</p>
                    <input
                        type="text"
                        value={newUsername}
                        onChange={e => setNewUsername(e.target.value)}
                        maxLength={255}
                        className="w-full text-xs px-3 py-2 border border-beige rounded-xl bg-cream text-navy outline-none focus:border-primary mb-3"
                        placeholder="New username..."
                        autoFocus
                    />
                    {error && <p className="text-xs text-dangerText mb-2">{error}</p>}
                    <div className="flex gap-2">
                        <Button variant="primary" className="flex-1 py-1.5 text-xs" onClick={handleSave} disabled={loading}>
                            {loading ? 'Saving...' : 'Save'}
                        </Button>
                        <Button variant="muted" className="flex-1 py-1.5 text-xs" onClick={() => { setEditing(false); setError('') }}>
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : (
                <div>
                    <div className="bg-cream border border-beige rounded-xl px-3 py-2 mt-1">
                        <p className="text-sm text-navy">{currentUsername}</p>
                    </div>
                    {success && <p className="text-xs text-successText mt-1">{success}</p>}
                </div>
            )}
        </Card>
    )
}

function BandNameEdit({ user, band, onBandNameChange }) {
    const [editing, setEditing] = useState(false)
    const [newName, setNewName] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [currentName, setCurrentName] = useState(band.band_name)

    function handleSave() {
        if (!newName.trim() || newName.trim() === currentName) { setEditing(false); return }
        setLoading(true); setError(''); setSuccess('')
        fetch(`${API_URL}/api/band/edit-band-name`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, band_id: band.band_id, name: newName.trim() })
        })
            .then(res => res.json())
            .then(data => {
                setLoading(false)
                if (data.new_name || data.message?.toLowerCase().includes('success') || data.message?.toLowerCase().includes('already')) {
                    const updated = data.new_name || newName.trim()
                    setCurrentName(updated)
                    if (onBandNameChange) onBandNameChange(band.band_id, updated)
                    setSuccess(data.message || 'Band name updated!')
                    setEditing(false)

                } else {
                    setError(data.message || 'Failed to update band name.')
                }
            })
            .catch(() => { setLoading(false); setError('Something went wrong.') })
    }

    return (
        <Card className="p-4">
            <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium text-navy">Band name — {band.band_name}</p>
                {!editing && (
                    <button
                        onClick={() => { setEditing(true); setNewName(currentName); setError(''); setSuccess('') }}
                        className="text-xs text-navy opacity-50 hover:opacity-100"
                    >Edit</button>
                )}
            </div>
            {editing ? (
                <div>
                    <p className="text-xs text-navy opacity-40 line-through mb-2">{currentName}</p>
                    <input
                        type="text"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        maxLength={255}
                        className="w-full text-xs px-3 py-2 border border-beige rounded-xl bg-cream text-navy outline-none focus:border-primary mb-3"
                        placeholder="New band name..."
                        autoFocus
                    />
                    {error && <p className="text-xs text-dangerText mb-2">{error}</p>}
                    <div className="flex gap-2">
                        <Button variant="primary" className="flex-1 py-1.5 text-xs" onClick={handleSave} disabled={loading}>
                            {loading ? 'Saving...' : 'Save'}
                        </Button>
                        <Button variant="muted" className="flex-1 py-1.5 text-xs" onClick={() => { setEditing(false); setError('') }}>
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : (
                <div>
                    <div className="bg-cream border border-beige rounded-xl px-3 py-2 mt-1">
                        <p className="text-sm text-navy">{currentName}</p>
                    </div>
                    {success && <p className="text-xs text-successText mt-1">{success}</p>}
                </div>
            )}
        </Card>
    )
}

export default function SettingsTab({ user, me, effectsProps = {}, role, myBands = [], onLogout, onUsernameChange, onBandNameChange }) {
    const { mousemoveEffects = true, clickEffects = true, toggleMousemove = () => { }, toggleClick = () => { } } = effectsProps
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true')

    function toggleDarkMode(val) {
        setDarkMode(val)
        localStorage.setItem('darkMode', String(val))
        if (val) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }
    const leaderBands = myBands.filter(b => b.is_leader || b.member_role === 'leader')

    const usernameEndpoint = role === 'admin'
        ? '/api/admin/edit-username'
        : '/api/individual/edit-username'

    const usernameExtraBody = role === 'admin'
        ? { admin_user_id: user.id, user_id: user.id }
        : {}

    return (
        <div className="space-y-6">

            {/* links */}
            <div>
                <SectionLabel>Links</SectionLabel>
                <div className="space-y-3">
                    <a href={GCAL_URL} target="_blank" rel="noopener noreferrer" className="block">
                        <Card className="p-4 flex justify-between items-center hover:opacity-80 transition-opacity">
                            <div>
                                <p className="text-sm font-medium text-navy">Google Calendar</p>
                                <p className="text-xs text-navy opacity-50 mt-1">View the shared MR booking calendar</p>
                            </div>
                            <Badge variant="success">Open ↗</Badge>
                        </Card>
                    </a>

                    {!me?.telegram_chat_id ? (
                        <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="block">
                            <Card className="p-4 flex justify-between items-center hover:opacity-80 transition-opacity">
                                <div>
                                    <p className="text-sm font-medium text-navy">Telegram bot</p>
                                    <p className="text-xs text-navy opacity-50 mt-1">Not linked — tap to connect</p>
                                </div>
                                <Badge variant="danger">Link ↗</Badge>
                            </Card>
                        </a>
                    ) : (
                        <Card className="p-4 flex justify-between items-center">
                            <div>
                                <p className="text-sm font-medium text-navy">Telegram bot</p>
                                <p className="text-xs text-navy opacity-50 mt-1">Notifications linked ✓</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="success">Active</Badge>
                                <button
                                    onClick={() => {
                                        if (!window.confirm('Unlink Telegram? You will stop receiving notifications until you re-link.')) return
                                        fetch(`${API_URL}/api/auth/unlink-telegram`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ user_id: user.id })
                                        })
                                            .then(res => res.json())
                                            .then(() => {
                                                const stored = JSON.parse(localStorage.getItem('user') || '{}')
                                                localStorage.setItem('user', JSON.stringify({ ...stored, telegram_chat_id: null }))
                                                window.location.reload()
                                            })
                                            .catch(() => { })
                                    }}
                                    className="text-xs text-dangerText opacity-60 hover:opacity-100"
                                >
                                    Unlink
                                </button>
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {/* effects */}
            <div>
                <SectionLabel>Visual effects</SectionLabel>
                <div className="space-y-3">
                    <ToggleRow
                        label="🌙 Dark mode"
                        description="Dark background with glowing blobs"
                        value={darkMode}
                        onToggle={toggleDarkMode}
                    />
                    <ToggleRow
                        label="✨ Cursor trail"
                        description="Floating music notes follow your cursor"
                        value={mousemoveEffects}
                        onToggle={toggleMousemove}
                    />
                    <ToggleRow
                        label="💥 Click burst"
                        description="Emoji explosion on every click"
                        value={clickEffects}
                        onToggle={toggleClick}
                    />
                </div>
            </div>

            {/* account */}
            <div>
                <SectionLabel>Account</SectionLabel>
                <div className="space-y-3">
                    <UsernameEdit
                        user={user}
                        apiEndpoint={usernameEndpoint}
                        extraBody={usernameExtraBody}
                        onUsernameChange={onUsernameChange}
                    />
                    {role === 'leader' && leaderBands.map(band => (
                        <BandNameEdit key={band.band_id} user={user} band={band} onBandNameChange={onBandNameChange} />
                    ))}
                </div>
            </div>

            {/* logout */}
            <Button variant="secondary" className="w-full" onClick={onLogout}>
                Log Out
            </Button>

        </div>
    )
}