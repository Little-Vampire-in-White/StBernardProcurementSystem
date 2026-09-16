import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useEffect, useRef, useState } from "react";

type UserMetaCardProps = {
  name: string;
  role: string;
  email: string;
  barangay: string;
  status: "active" | "pending" | "rejected";
};

export default function UserMetaCard({
  name,
  role,
  email,
  barangay,
  status,
}: UserMetaCardProps) {
  const { isOpen, openModal, closeModal } = useModal();
  const apiFetch = useApi();
  const { refreshProfile, profile } = useAuth();

  const [firstName, setFirstName] = useState(() => String(name || '').split(' ')[0] || '');
  const [lastName, setLastName] = useState(() => (String(name || '').split(' ').slice(1).join(' ')) || '');
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<HTMLImageElement | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const drawCrop = (canvas: HTMLCanvasElement, image: HTMLImageElement) => {
    const size = Math.min(image.naturalWidth, image.naturalHeight) / cropZoom;
    const sourceX = (image.naturalWidth - size) * (cropX / 100);
    const sourceY = (image.naturalHeight - size) * (cropY / 100);
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = 512;
    canvas.height = 512;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, sourceX, sourceY, size, size, 0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    if (cropImage && cropCanvasRef.current) drawCrop(cropCanvasRef.current, cropImage);
  }, [cropImage, cropZoom, cropX, cropY]);

  const closeCropper = () => {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
    setCropImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectAvatar = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setCropSource(source);
      setCropImage(image);
      setCropZoom(1);
      setCropX(50);
      setCropY(50);
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      alert('The selected image could not be opened.');
    };
    image.src = source;
  };

  const uploadCroppedAvatar = async () => {
    const canvas = cropCanvasRef.current;
    if (!canvas || !cropImage) return;

    setIsUploadingAvatar(true);
    try {
      drawCrop(canvas, cropImage);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('Unable to crop the image');

      const fd = new FormData();
      fd.append('avatar', new File([blob], 'profile-avatar.jpg', { type: 'image/jpeg' }));
      const res = await apiFetch('/api/auth/avatar', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Upload failed');
      }
      await refreshProfile();
      closeCropper();
    } catch (err: any) {
      console.error('Avatar upload failed', err);
      alert(err?.message || 'Upload failed');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    try {
      const displayName = `${firstName} ${lastName}`.trim();
      const body = {
        display_name: displayName,
        role,
        barangay_id: profile?.barangayId ?? null,
      };

      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Unable to save profile');
      }
      await refreshProfile();
      closeModal();
    } catch (err: any) {
      console.error('Failed to save profile', err);
      alert(err?.message || 'Save failed');
    }
  };
  return (
    <>
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col items-center w-full gap-6 xl:flex-row">
            <div className="w-20 h-20 overflow-hidden border border-gray-200 rounded-full dark:border-gray-800">
              <label className="block w-full h-full cursor-pointer">
                <img
                  src={profile?.profileImageUrl || '/images/user/owner.jpg'}
                  alt="user"
                  className="w-full h-full object-cover"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = '/images/user/owner.jpg';
                  }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => selectAvatar(event.target.files?.[0])}
                />
              </label>
            </div>
            <div className="order-3 xl:order-2">
              <h4 className="mb-2 text-lg font-semibold text-center text-gray-800 dark:text-white/90 xl:text-left">
                {name}
              </h4>
              <div className="flex flex-col items-center gap-1 text-center xl:flex-row xl:gap-3 xl:text-left">
                <p className="text-sm text-gray-500 dark:text-gray-400">{role}</p>
                <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{barangay}</p>
                <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{email}</p>
              </div>
            </div>
            <div className="flex items-center order-2 gap-2 grow xl:order-3 xl:justify-end">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                status === 'active'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                  : status === 'pending'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
              }`}>
                {status}
              </span>
            </div>
          </div>
          <button
            onClick={openModal}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto"
          >
            <svg
              className="fill-current"
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M15.0911 2.78206C14.2125 1.90338 12.7878 1.90338 11.9092 2.78206L4.57524 10.116C4.26682 10.4244 4.0547 10.8158 3.96468 11.2426L3.31231 14.3352C3.25997 14.5833 3.33653 14.841 3.51583 15.0203C3.69512 15.1996 3.95286 15.2761 4.20096 15.2238L7.29355 14.5714C7.72031 14.4814 8.11172 14.2693 8.42013 13.9609L15.7541 6.62695C16.6327 5.74827 16.6327 4.32365 15.7541 3.44497L15.0911 2.78206ZM12.9698 3.84272C13.2627 3.54982 13.7376 3.54982 14.0305 3.84272L14.6934 4.50563C14.9863 4.79852 14.9863 5.2734 14.6934 5.56629L14.044 6.21573L12.3204 4.49215L12.9698 3.84272ZM11.2597 5.55281L5.6359 11.1766C5.53309 11.2794 5.46238 11.4099 5.43238 11.5522L5.01758 13.5185L6.98394 13.1037C7.1262 13.0737 7.25666 13.003 7.35947 12.9002L12.9833 7.27639L11.2597 5.55281Z"
                fill=""
              />
            </svg>
            Edit
          </button>
        </div>
      </div>
      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
        <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
            <div className="px-2 pr-14">
              <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                Edit Personal Information
              </h4>
              <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
                Update your details to keep your profile up-to-date.
              </p>
            </div>
            <form className="flex flex-col">
              <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">
                {/* Social links removed per request */}
                <div className="mt-7">
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                  Personal Information
                </h5>

                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  <div className="col-span-2 lg:col-span-1">
                    <Label>First Name</Label>
                    <Input type="text" value={firstName} onChange={(e)=>setFirstName(e.target.value)} />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Last Name</Label>
                    <Input type="text" value={lastName} onChange={(e)=>setLastName(e.target.value)} />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Email Address</Label>
                    <Input type="text" value="randomuser@pimjo.com" />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Phone</Label>
                    <Input type="text" value="+09 363 398 46" />
                  </div>

                  <div className="col-span-2">
                    <Label>Bio</Label>
                    <Input type="text" value="Team Manager" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" onClick={closeModal}>
                Close
              </Button>
              <Button size="sm" onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      </Modal>
      <Modal isOpen={Boolean(cropSource)} onClose={closeCropper} className="max-w-lg m-4">
        <div className="p-6">
          <h4 className="text-xl font-semibold text-gray-800 dark:text-white">Crop profile picture</h4>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Adjust the crop, then save your new profile picture.</p>
          <div className="mx-auto mt-5 w-72 h-72 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <canvas ref={cropCanvasRef} className="h-full w-full" aria-label="Profile image crop preview" />
          </div>
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Zoom
              <input className="mt-2 w-full accent-brand-500" type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={(event) => setCropZoom(Number(event.target.value))} />
            </label>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Horizontal position
              <input className="mt-2 w-full accent-brand-500" type="range" min="0" max="100" value={cropX} onChange={(event) => setCropX(Number(event.target.value))} />
            </label>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Vertical position
              <input className="mt-2 w-full accent-brand-500" type="range" min="0" max="100" value={cropY} onChange={(event) => setCropY(Number(event.target.value))} />
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button size="sm" variant="outline" onClick={closeCropper}>Cancel</Button>
            <Button size="sm" onClick={uploadCroppedAvatar} disabled={isUploadingAvatar}>
              {isUploadingAvatar ? 'Saving...' : 'Crop & Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
