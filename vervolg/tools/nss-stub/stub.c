/*
 * Path: tools/nss-stub/stub.c — build with ./build.sh
 *
 * (generated from the undefined-symbol list of @sparticuz/chromium)
 * Minimal stubs for the NSS/NSPR symbols Chromium links against.
 *
 * Purpose: run a headless Chromium in a container that has no libnss3, to
 * measure the layout of pages served over plain HTTP on localhost.
 *
 * SCOPE AND LIMIT: these are not NSS. Every function returns NULL / failure,
 * so Chromium sees "no certificate database" and cannot validate or load TLS
 * client certificates. That is sufficient for http://localhost, which is the
 * only thing this build is measured against. It is NOT a way to browse HTTPS
 * and must never be used for anything but local verification.
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

/* Every entry point returns a null pointer, a zero count, or failure. */
void *__stub_ret_null(void) { return 0; }
long __stub_ret_zero(void) { return 0; }
void *CERT_CreateSubjectCertList(void) { return 0; }
void *CERT_DestroyCertList(void) { return 0; }
void *CERT_DestroyCertificate(void) { return 0; }
void *CERT_DupCertificate(void) { return 0; }
void *CERT_FindCertByDERCert(void) { return 0; }
void *CERT_GetCertTrust(void) { return 0; }
void *CERT_GetDefaultCertDB(void) { return 0; }
void *CERT_IsUserCert(void) { return 0; }
void *NSS_InitReadWrite(void) { return 0; }
void *NSS_NoDB_Init(void) { return 0; }
void *NSS_SetAlgorithmPolicy(void) { return 0; }
int NSS_VersionCheck(const char *v) { (void)v; return 0; }
void *PK11_DestroyGenericObjects(void) { return 0; }
void *PK11_FindCertInSlot(void) { return 0; }
void *PK11_FindGenericObjects(void) { return 0; }
void *PK11_FreeSlot(void) { return 0; }
void *PK11_GetInternalKeySlot(void) { return 0; }
void *PK11_GetModule(void) { return 0; }
void *PK11_GetNextGenericObject(void) { return 0; }
void *PK11_GetTokenName(void) { return 0; }
void *PK11_HasAttributeSet(void) { return 0; }
void *PK11_HasRootCerts(void) { return 0; }
void *PK11_InitPin(void) { return 0; }
void *PK11_IsPresent(void) { return 0; }
void *PK11_ListCerts(void) { return 0; }
void *PK11_ListCertsInSlot(void) { return 0; }
void *PK11_NeedUserInit(void) { return 0; }
void *PK11_ReadRawAttribute(void) { return 0; }
void *PK11_ReferenceSlot(void) { return 0; }
void *PK11_SetPasswordFunc(void) { return 0; }
long PR_GetError(void) { return 0; }
char *PR_GetErrorText(long e) { (void)e; static char b[] = ""; return b; }
long PR_GetErrorTextLength(long e) { (void)e; return 0; }
long PR_GetOSError(void) { return 0; }
void PR_Init(int a, int b, int c) { (void)a; (void)b; (void)c; }
int64_t PR_Now(void) { struct timespec ts; clock_gettime(CLOCK_REALTIME, &ts); return (int64_t)ts.tv_sec * 1000000 + ts.tv_nsec / 1000; }
void *SECITEM_AllocItem(void) { return 0; }
void *SECITEM_FreeItem(void) { return 0; }
void *SECMOD_DestroyModule(void) { return 0; }
void *SECMOD_GetDefaultModuleList(void) { return 0; }
void *SECMOD_GetDefaultModuleListLock(void) { return 0; }
void *SECMOD_GetReadLock(void) { return 0; }
void *SECMOD_LoadUserModule(void) { return 0; }
void *SECMOD_ReleaseReadLock(void) { return 0; }
