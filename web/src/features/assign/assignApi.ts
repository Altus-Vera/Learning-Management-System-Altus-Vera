import { api } from '../../services/api'
import { call, errorMessage } from '../../services/sync'
import { toast } from '../../components/Toast'
import type { SubmissionFile } from '../../store/lmsStore'

export const uploadFile = (activityId: number, file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/api/v1/assignments/${activityId}/files`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
}

export const deleteFile = (fileId: number) => call(() => api.delete(`/api/v1/submission-files/${fileId}`))
export const saveSubmission = (activityId: number, onlineText: string) => call(() => api.put(`/api/v1/assignments/${activityId}/submission`, { onlineText }))
export const submitForGrading = (activityId: number) => call(() => api.post(`/api/v1/assignments/${activityId}/submit`, { statementAccepted: true }))
export const removeSubmission = (activityId: number) => call(() => api.delete(`/api/v1/assignments/${activityId}/submission`))

export async function downloadFile(f: SubmissionFile) {
  if (!f.id || !f.downloadable) return toast(`${f.name} is sample data and has no stored file.`, 'info')
  try {
    const res = await api.get(`/api/v1/submission-files/${f.id}`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data as Blob)
    const link = document.createElement('a')
    link.href = url
    link.download = f.name
    link.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    toast(errorMessage(e), 'error')
  }
}
