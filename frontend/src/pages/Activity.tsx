import { useState } from 'react'
import ActivityCalendar from '../components/ActivityCalendar'
import AttendanceRecords from '../components/AttendanceRecords'
import EditAttendanceRecords from '../components/EditAttendanceRecords'

const Activity = () => {
    const [weekStart, setWeekStart] = useState<Date | null>(null)
    // shared incrementing token to signal that activities/client_activity changed
    const [dataVersion, setDataVersion] = useState(0)

    return (
        <div>
            <h1 className="page-title">Activity</h1>
            <ActivityCalendar onWeekChange={(d: Date) => setWeekStart(d)} onEventCreated={() => setDataVersion(v => v + 1)} />

            <div className='edit-attendance'>
                <div className='attendance-title'>Edit Attendance Records</div>
                <EditAttendanceRecords weekStart={weekStart} refreshToken={dataVersion} onDataChanged={() => setDataVersion(v => v + 1)} />
            </div>

            <div className="attendance-section">
                <div className="attendance-title">Attendance Records This Week</div>
                <AttendanceRecords weekStart={weekStart} refreshToken={dataVersion} />
            </div>
        </div>
    )
}

export default Activity

