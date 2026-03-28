import Modal from '@app/components/Common/Modal';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import type { LidarrSettings } from '@server/lib/settings';
import axios from 'axios';
import { Field, Formik } from 'formik';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import * as Yup from 'yup';

const profiles = [
  { id: 1, name: 'minimum' },
  { id: 2, name: 'low' },
  { id: 3, name: 'medium' },
  { id: 4, name: 'high' },
  { id: 5, name: 'lossless' },
  { id: 6, name: 'hifi' },
];

const textFields = [
  { name: 'name', label: 'servername', required: true },
  { name: 'executablePath', label: 'executablePath', required: true },
  { name: 'workingDirectory', label: 'workingDirectory', required: true },
  { name: 'scriptPath', label: 'scriptPath', required: true },
  { name: 'rootFolder', label: 'rootfolder', required: true },
  { name: 'moduleName', label: 'moduleName', required: true },
  { name: 'externalUrl', label: 'externalUrl', required: false },
] as const;

const messages = defineMessages('components.Settings.LidarrModal', {
  create: 'Add OrpheusDL Service',
  edit: 'Edit OrpheusDL Service',
  validationNameRequired: 'You must provide a service name',
  validationWorkingDirectoryRequired:
    'You must provide an OrpheusDL working directory',
  validationScriptPathRequired: 'You must provide the OrpheusDL script path',
  validationRootFolderRequired: 'You must provide a download path',
  validationProfileRequired: 'You must select a default TIDAL quality',
  validationApplicationUrl: 'You must provide a valid URL',
  validationApplicationUrlTrailingSlash: 'URL must not end in a trailing slash',
  validationExecutablePathRequired: 'You must provide a Python executable',
  validationModuleRequired: 'You must provide the OrpheusDL module name',
  toastTestSuccess: 'OrpheusDL/TIDAL settings validated successfully.',
  toastTestFailure: 'Failed to validate OrpheusDL/TIDAL settings.',
  add: 'Add Service',
  defaultserver: 'Default Service',
  servername: 'Service Name',
  executablePath: 'Python Executable',
  workingDirectory: 'OrpheusDL Working Directory',
  scriptPath: 'Script Path',
  externalUrl: 'External URL',
  qualityprofile: 'Default TIDAL Quality',
  rootfolder: 'Download Path',
  moduleName: 'Module Name',
});

interface LidarrModalProps {
  lidarr: LidarrSettings | null;
  onClose: () => void;
  onSave: () => void;
}

const LidarrModal = ({ onClose, lidarr, onSave }: LidarrModalProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const initialLoad = useRef(false);
  const [isValidated, setIsValidated] = useState(!!lidarr);
  const [isTesting, setIsTesting] = useState(false);

  const schema = Yup.object().shape({
    name: Yup.string().required(
      intl.formatMessage(messages.validationNameRequired)
    ),
    executablePath: Yup.string().required(
      intl.formatMessage(messages.validationExecutablePathRequired)
    ),
    workingDirectory: Yup.string().required(
      intl.formatMessage(messages.validationWorkingDirectoryRequired)
    ),
    scriptPath: Yup.string().required(
      intl.formatMessage(messages.validationScriptPathRequired)
    ),
    rootFolder: Yup.string().required(
      intl.formatMessage(messages.validationRootFolderRequired)
    ),
    activeProfileId: Yup.number().required(
      intl.formatMessage(messages.validationProfileRequired)
    ),
    moduleName: Yup.string().required(
      intl.formatMessage(messages.validationModuleRequired)
    ),
    externalUrl: Yup.string()
      .url(intl.formatMessage(messages.validationApplicationUrl))
      .test(
        'no-trailing-slash',
        intl.formatMessage(messages.validationApplicationUrlTrailingSlash),
        (value) => !value || !value.endsWith('/')
      ),
  });

  const testConnection = useCallback(
    async (values: {
      executablePath: string;
      workingDirectory: string;
      scriptPath: string;
      rootFolder: string;
      activeProfileId: number;
      moduleName: string;
      externalUrl?: string;
    }) => {
      setIsTesting(true);
      try {
        await axios.post('/api/v1/settings/lidarr/test', {
          executablePath: values.executablePath,
          workingDirectory: values.workingDirectory,
          scriptPath: values.scriptPath,
          activeDirectory: values.rootFolder,
          activeProfileId: Number(values.activeProfileId),
          moduleName: values.moduleName,
          externalUrl: values.externalUrl,
        });

        setIsValidated(true);
        if (initialLoad.current) {
          addToast(intl.formatMessage(messages.toastTestSuccess), {
            appearance: 'success',
            autoDismiss: true,
          });
        }
      } catch (_error) {
        setIsValidated(false);
        if (initialLoad.current) {
          addToast(intl.formatMessage(messages.toastTestFailure), {
            appearance: 'error',
            autoDismiss: true,
          });
        }
      } finally {
        setIsTesting(false);
        initialLoad.current = true;
      }
    },
    [addToast, intl]
  );

  useEffect(() => {
    if (lidarr) {
      void testConnection({
        executablePath: lidarr.executablePath ?? 'python3',
        workingDirectory: lidarr.workingDirectory ?? '',
        scriptPath: lidarr.scriptPath ?? 'orpheus.py',
        rootFolder: lidarr.activeDirectory,
        activeProfileId: lidarr.activeProfileId,
        moduleName: lidarr.moduleName ?? 'tidal',
        externalUrl: lidarr.externalUrl,
      });
    }
  }, [lidarr, testConnection]);

  return (
    <Transition
      as="div"
      appear
      show
      enter="transition-opacity ease-in-out duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity ease-in-out duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <Formik
        initialValues={{
          name: lidarr?.name ?? 'OrpheusDL (TIDAL)',
          executablePath:
            lidarr?.executablePath ??
            './vendor/orpheusdl-core/.venv/bin/python',
          workingDirectory:
            lidarr?.workingDirectory ?? './vendor/orpheusdl-core',
          scriptPath: lidarr?.scriptPath ?? 'orpheus.py',
          rootFolder: lidarr?.activeDirectory ?? './downloads/music',
          activeProfileId: lidarr?.activeProfileId ?? 5,
          moduleName: lidarr?.moduleName ?? 'tidal',
          externalUrl: lidarr?.externalUrl ?? '',
          isDefault: lidarr?.isDefault ?? true,
        }}
        validationSchema={schema}
        onSubmit={async (values) => {
          const selectedProfile = profiles.find(
            (profile) => profile.id === Number(values.activeProfileId)
          );

          const submission: LidarrSettings = {
            id: lidarr?.id ?? 0,
            name: values.name,
            hostname: '',
            port: 0,
            apiKey: '',
            useSsl: false,
            activeProfileId: Number(values.activeProfileId),
            activeProfileName: selectedProfile?.name ?? 'lossless',
            activeDirectory: values.rootFolder,
            tags: [],
            is4k: false,
            isDefault: values.isDefault,
            externalUrl: values.externalUrl || undefined,
            syncEnabled: false,
            preventSearch: false,
            tagRequests: false,
            overrideRule: [],
            activeMetadataProfileId: 1,
            activeMetadataProfileName: 'TIDAL',
            executablePath: values.executablePath,
            workingDirectory: values.workingDirectory,
            scriptPath: values.scriptPath,
            moduleName: values.moduleName,
          };

          if (!lidarr) {
            await axios.post('/api/v1/settings/lidarr', submission);
          } else {
            await axios.put(`/api/v1/settings/lidarr/${lidarr.id}`, submission);
          }

          onSave();
        }}
      >
        {({
          errors,
          touched,
          values,
          handleSubmit,
          setFieldValue,
          isSubmitting,
          isValid,
        }) => (
          <Modal
            onCancel={onClose}
            okButtonType="primary"
            okText={
              isSubmitting
                ? intl.formatMessage(globalMessages.saving)
                : lidarr
                  ? intl.formatMessage(globalMessages.save)
                  : intl.formatMessage(messages.add)
            }
            secondaryButtonType="warning"
            secondaryText={
              isTesting
                ? intl.formatMessage(globalMessages.testing)
                : intl.formatMessage(globalMessages.test)
            }
            onSecondary={() => void testConnection(values)}
            secondaryDisabled={isTesting || isSubmitting}
            okDisabled={!isValidated || isTesting || isSubmitting || !isValid}
            onOk={() => handleSubmit()}
            title={
              lidarr
                ? intl.formatMessage(messages.edit)
                : intl.formatMessage(messages.create)
            }
          >
            <div className="mb-6">
              <div className="form-row">
                <label htmlFor="isDefault" className="checkbox-label">
                  {intl.formatMessage(messages.defaultserver)}
                </label>
                <div className="form-input-area">
                  <Field type="checkbox" id="isDefault" name="isDefault" />
                </div>
              </div>

              {textFields.map((field) => (
                <div className="form-row" key={field.name}>
                  <label htmlFor={field.name} className="text-label">
                    {intl.formatMessage(messages[field.label])}
                    {field.required && (
                      <span className="label-required">*</span>
                    )}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        id={field.name}
                        name={field.name}
                        type="text"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setIsValidated(false);
                          setFieldValue(field.name, e.target.value);
                        }}
                      />
                    </div>
                    {errors[field.name] &&
                      touched[field.name] &&
                      typeof errors[field.name] === 'string' && (
                        <div className="error">{errors[field.name]}</div>
                      )}
                  </div>
                </div>
              ))}

              <div className="form-row">
                <label htmlFor="activeProfileId" className="text-label">
                  {intl.formatMessage(messages.qualityprofile)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <Field
                    as="select"
                    id="activeProfileId"
                    name="activeProfileId"
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      setIsValidated(false);
                      setFieldValue('activeProfileId', Number(e.target.value));
                    }}
                  >
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </Field>
                  {errors.activeProfileId &&
                    touched.activeProfileId &&
                    typeof errors.activeProfileId === 'string' && (
                      <div className="error">{errors.activeProfileId}</div>
                    )}
                </div>
              </div>
            </div>
          </Modal>
        )}
      </Formik>
    </Transition>
  );
};

export default LidarrModal;
