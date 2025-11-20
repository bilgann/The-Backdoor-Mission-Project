import React, { useState } from 'react'
import ActivityCalendar from '../components/ActivityCalendar'
import AttendanceRecords from '../components/AttendanceRecords'

const Activity = () => {
    const [weekStart, setWeekStart] = useState<Date | null>(null)

    return (
        <div>
            <h1 className="page-title">Activity</h1>
            <ActivityCalendar onWeekChange={(d: Date) => setWeekStart(d)} />

            <div style={{ marginTop: 150 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Attendance Records This Week</div>
                <AttendanceRecords weekStart={weekStart} />
            </div>
        </div>
    )
}

export default Activity

