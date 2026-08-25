;;; ==================================================================
;;;  BTSLoad.lsp
;;;  BTS Enterprise Standards Suite - loader
;;;
;;;  (load "X:/CAD/BTS/BTSLoad.lsp")
;;;
;;;  Order matters: BTSEnterprise.lsp defines the registers, the helpers
;;;  and *BTS-HELP*, which every other module appends to.
;;; ==================================================================

(setq *BTS-MODULES* '("BTSEnterprise.lsp"
                      "BTSBatch.lsp"
                      "BTSSurvey.lsp"
                      "BTSAnno.lsp"
                      "BTSProject.lsp"))

;;; *BTS-HOME* may already be set - a generated batch script sets it
;;; before loading, because the suite folder is not necessarily on the
;;; support path of the drawing being processed.
(if (null *BTS-HOME*)
  (if (setq *BTS-HOME* (findfile "BTSLoad.lsp"))
    (setq *BTS-HOME* (strcat (vl-string-translate "\\" "/"
                              (vl-filename-directory *BTS-HOME*)) "/"))))

(defun bts:load-all (/ m p n)
  (setq n 0)
  (foreach m *BTS-MODULES*
    (setq p (cond ((and *BTS-HOME* (findfile (strcat *BTS-HOME* m))))
                  ((findfile m))))
    (if p
      (progn (load p) (setq n (1+ n)))
      (princ (strcat "\nBTS: module not found - " m))))
  n)

(if (= (length *BTS-MODULES*) (bts:load-all))
  (progn
    (princ (strcat "\nBTS " *BTS-STD-VERSION* " loaded."))
    (princ "\nBTSHELP lists every command."))
  (princ "\nBTS: incomplete load - check the suite folder is on the support path."))

(princ)
